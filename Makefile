# Reproduction targets; each calls scripts/repro.py. See README.md, "How to reproduce".
PYTHON ?= python3

.PHONY: level0 level0-mock conformance profile-a pq-drill amsterdam connector-proof

level0:
	$(PYTHON) scripts/repro.py level0

level0-mock:
	$(PYTHON) scripts/repro.py level0-mock

conformance:
	$(PYTHON) scripts/repro.py conformance

profile-a:
	$(PYTHON) scripts/repro.py profile-a

pq-drill:
	$(PYTHON) scripts/repro.py pq-drill

amsterdam:
	$(PYTHON) scripts/repro.py amsterdam

connector-proof:
	$(PYTHON) scripts/repro.py connector-proof
