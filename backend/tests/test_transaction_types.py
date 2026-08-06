from app.models import TransactionType


def test_stamp_duty_transaction_type_is_available():
    assert TransactionType.STAMP_DUTY.value == "stamp_duty"
