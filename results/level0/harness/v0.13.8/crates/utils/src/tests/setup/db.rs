use alloy::primitives::U256;
use sqlx::{Pool, Postgres, types::chrono::Utc};
use std::sync::atomic::{AtomicU64, Ordering};
use testcontainers::{ContainerAsync, GenericImage, ImageExt, core::WaitFor, runners::AsyncRunner};
use tracing::info;

const POSTGRES_PORT: u16 = 5432;

/// [lifecycle harness deviation from testcontainers] When this env var is set, the tests use the
/// already-running Postgres server it points to (an admin URL without password; the password is
/// supplied out-of-band through `PGPASSFILE`) and create one fresh database per test, instead of
/// starting a testcontainers Postgres whose published port would listen on all interfaces.
const EXTERNAL_PG_ADMIN_URL_ENV: &str = "LIFECYCLE_PG_ADMIN_URL";

/// Per-process counter used to build unique per-test database names on the external server.
static DB_COUNTER: AtomicU64 = AtomicU64::new(0);

pub struct DbInstance {
    /// Use to keep the database container running during the tests.
    /// `None` when running against the external server of `LIFECYCLE_PG_ADMIN_URL`.
    pub db_container: Option<ContainerAsync<GenericImage>>,
    pub db: Pool<Postgres>,
    pub url: String,
}

impl DbInstance {
    pub async fn setup() -> anyhow::Result<Self> {
        let (db_container, admin_db_url, db_name) = match std::env::var(EXTERNAL_PG_ADMIN_URL_ENV)
        {
            Ok(admin_db_url) => {
                let db_name = format!(
                    "kms_connector_test_{}_{}",
                    std::process::id(),
                    DB_COUNTER.fetch_add(1, Ordering::Relaxed),
                );
                info!("Using external Postgres server (no container), per-test DB '{db_name}'");
                (None, admin_db_url, db_name)
            }
            Err(_) => {
                info!("Starting Postgres container...");
                let container = GenericImage::new("postgres", "17.5")
                    .with_wait_for(WaitFor::message_on_stderr(
                        "database system is ready to accept connections",
                    ))
                    .with_env_var("POSTGRES_USER", "postgres")
                    .with_env_var("POSTGRES_PASSWORD", "postgres")
                    .start()
                    .await?;
                info!("Postgres container ready!");

                let cont_host = container.get_host().await?;
                let host_port = container.get_host_port_ipv4(POSTGRES_PORT).await?;
                let admin_db_url =
                    format!("postgresql://postgres:postgres@{cont_host}:{host_port}/postgres");
                (Some(container), admin_db_url, "kms-connector".to_string())
            }
        };
        let db_url = match admin_db_url.rsplit_once('/') {
            Some((prefix, _db)) => format!("{prefix}/{db_name}"),
            None => format!("{admin_db_url}/{db_name}"),
        };

        info!("Creating KMS Connector db...");
        let admin_pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .connect(&admin_db_url)
            .await?;
        sqlx::query(&format!("CREATE DATABASE \"{db_name}\";"))
            .execute(&admin_pool)
            .await?;
        admin_pool.close().await;
        info!("KMS Connector DB url: {db_url}");
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(10)
            .connect(&db_url)
            .await?;

        info!("Running migrations...");
        sqlx::migrate!("../../connector-db/migrations")
            .run(&pool)
            .await?;
        info!("KMS Connector DB ready!");

        info!("Inserting context #{TESTING_KMS_CONTEXT} for tests...");
        let now = Utc::now();
        sqlx::query!(
            "INSERT INTO kms_context(id, is_valid, created_at, updated_at) \
            VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
            TESTING_KMS_CONTEXT.as_le_slice(),
            true,
            now,
            now,
        )
        .execute(&pool)
        .await?;
        info!("Context #{TESTING_KMS_CONTEXT} is ready for tests!");

        Ok(DbInstance {
            db_container,
            db: pool,
            url: db_url,
        })
    }
}

pub const TESTING_KMS_CONTEXT: U256 = U256::ONE;
pub const TESTING_KMS_EPOCH: U256 = U256::ONE;
