import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["CORELLA_LLM"] = "mock"
os.environ["RAZORPAY_WEBHOOK_SECRET"] = "whsec_test"
