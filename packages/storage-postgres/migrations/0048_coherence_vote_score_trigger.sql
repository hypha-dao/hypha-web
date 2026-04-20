CREATE OR REPLACE FUNCTION coherence_votes_maintain_vote_score()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE coherences SET vote_score = vote_score + NEW.value WHERE id = NEW.coherence_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE coherences SET vote_score = vote_score - OLD.value WHERE id = OLD.coherence_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.coherence_id = OLD.coherence_id THEN
      UPDATE coherences SET vote_score = vote_score + (NEW.value - OLD.value) WHERE id = NEW.coherence_id;
    ELSE
      UPDATE coherences SET vote_score = vote_score - OLD.value WHERE id = OLD.coherence_id;
      UPDATE coherences SET vote_score = vote_score + NEW.value WHERE id = NEW.coherence_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS coherence_votes_maintain_vote_score_trg ON coherence_votes;

CREATE TRIGGER coherence_votes_maintain_vote_score_trg
AFTER INSERT OR UPDATE OR DELETE ON coherence_votes
FOR EACH ROW EXECUTE PROCEDURE coherence_votes_maintain_vote_score();
