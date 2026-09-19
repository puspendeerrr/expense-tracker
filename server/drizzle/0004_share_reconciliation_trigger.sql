-- Share reconciliation as a database invariant.
--
-- Every expense must satisfy:  SUM(expense_participants.share_paise) = expenses.amount_paise
--
-- This is enforced by a DEFERRABLE INITIALLY DEFERRED constraint trigger, which fires at
-- COMMIT rather than per statement. Deferral is essential: a legitimate write inserts the
-- expense and its participant rows as separate statements, and is transiently unbalanced
-- in between. Checking at COMMIT lets correct transactions through while making a drifted
-- split -- the class of bug that silently lost paise in the reference implementation --
-- impossible to persist.
--
-- An expense with zero participant rows is also rejected: an expense nobody benefits from
-- is not a valid financial record.

CREATE OR REPLACE FUNCTION assert_expense_shares_reconcile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_expense_id uuid;
  expected_paise    bigint;
  actual_paise      bigint;
  participant_count integer;
BEGIN
  -- Resolve the affected expense from whichever side of the change fired the trigger.
  IF TG_TABLE_NAME = 'expenses' THEN
    target_expense_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    target_expense_id := OLD.expense_id;
  ELSE
    target_expense_id := NEW.expense_id;
  END IF;

  SELECT amount_paise INTO expected_paise
    FROM expenses
   WHERE id = target_expense_id;

  -- The expense itself was deleted in this transaction; its participants cascade away.
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(share_paise), 0), COUNT(*)
    INTO actual_paise, participant_count
    FROM expense_participants
   WHERE expense_id = target_expense_id;

  IF participant_count = 0 THEN
    RAISE EXCEPTION
      'Expense % has no participants; every expense must have at least one beneficiary',
      target_expense_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF actual_paise <> expected_paise THEN
    RAISE EXCEPTION
      'Expense % share reconciliation failed: participant shares total % paise but the expense is % paise',
      target_expense_id, actual_paise, expected_paise
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;
--> statement-breakpoint

CREATE CONSTRAINT TRIGGER expense_participants_reconcile
  AFTER INSERT OR UPDATE OR DELETE ON expense_participants
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION assert_expense_shares_reconcile();
--> statement-breakpoint

-- Also fires when the expense total itself changes, so an edit cannot move the amount
-- away from shares that were left untouched.
CREATE CONSTRAINT TRIGGER expenses_reconcile
  AFTER INSERT OR UPDATE OF amount_paise ON expenses
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION assert_expense_shares_reconcile();
