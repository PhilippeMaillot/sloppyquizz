from __future__ import annotations

from dataclasses import dataclass

from app.utils.text_normalization import normalize_text


@dataclass(frozen=True)
class ScoringResult:
    is_correct: bool
    points_awarded: float
    validation: dict


class ScoringService:
    def validate_submitted_answer_auto(self, slide: dict, submitted_answer: dict) -> ScoringResult:
        """
        Legacy auto validation helper:
        - single_choice: selected answerId must match the unique correct answerId
        - true_false: if present, compares boolean-ish value to slide.correctValue
        - text_answer: exact match on normalized expectedAnswer

        New live gameplay uses manual host validation during reveal.
        """
        slide_type = slide.get("type")
        slide_points = float(slide.get("points") or 0)

        if slide_type == "single_choice":
            is_correct = self._is_correct_single_choice(slide, submitted_answer.get("answer"))
            return self._build_auto_result(is_correct, slide_points)

        if slide_type == "true_false":
            is_correct = self._is_correct_true_false(slide, submitted_answer.get("answer"))
            return self._build_auto_result(is_correct, slide_points)

        if slide_type == "text_answer":
            is_correct = self._is_correct_text_answer(slide, submitted_answer.get("answer"))
            return self._build_auto_result(is_correct, slide_points)

        if slide_type == "blind_test":
            answer_mode = slide.get("answerMode", "text")
            if answer_mode == "text":
                is_correct = self._is_correct_text_answer(slide, submitted_answer.get("answer"))
                return self._build_auto_result(is_correct, slide_points)
            if answer_mode == "single_choice":
                is_correct = self._is_correct_single_choice(slide, submitted_answer.get("answer"))
                return self._build_auto_result(is_correct, slide_points)
        return ScoringResult(
            is_correct=False,
            points_awarded=0,
            validation={"method": "none", "confidence": None, "reason": None, "validatedBy": None},
        )

    def apply_manual_override(
        self,
        slide: dict,
        submitted_answer: dict,
        *,
        is_correct: bool,
        host_id: str,
        points_awarded: float | None = None,
    ) -> ScoringResult:
        slide_points = float(slide.get("points") or 0)
        if points_awarded is None:
            final_points = slide_points if is_correct else 0.0
        else:
            final_points = min(max(float(points_awarded), 0.0), slide_points)
        return ScoringResult(
            is_correct=bool(is_correct),
            points_awarded=final_points,
            validation={
                "method": "manual",
                "confidence": None,
                "reason": None,
                "validatedBy": host_id,
            },
        )

    def recalculate_player_scores(self, players: list[dict], answers: list[dict]) -> list[dict]:
        points_by_player: dict[str, float] = {}
        for answer in answers:
            validation_method = (answer.get("validation") or {}).get("method", "none")
            # Only count answers that were actually validated.
            if validation_method != "manual":
                continue
            player_id = answer.get("playerId")
            if not isinstance(player_id, str) or not player_id:
                continue
            points_by_player[player_id] = points_by_player.get(player_id, 0.0) + float(
                answer.get("pointsAwarded") or 0
            )

        updated_players: list[dict] = []
        for player in players:
            player_id = player.get("playerId")
            if isinstance(player_id, str) and player_id:
                updated_players.append({**player, "score": points_by_player.get(player_id, 0)})
            else:
                updated_players.append(player)
        return updated_players

    def _build_auto_result(self, is_correct: bool, slide_points: float) -> ScoringResult:
        return ScoringResult(
            is_correct=bool(is_correct),
            points_awarded=slide_points if is_correct else 0,
            validation={"method": "auto", "confidence": None, "reason": None, "validatedBy": None},
        )

    def _is_correct_single_choice(self, slide: dict, answer: object) -> bool:
        if not isinstance(answer, str) or not answer:
            return False
        correct_ids = [
            choice.get("id")
            for choice in slide.get("answers", [])
            if (choice or {}).get("isCorrect") is True
        ]
        if len(correct_ids) != 1:
            return False
        return answer == correct_ids[0]

    def _is_correct_text_answer(self, slide: dict, answer: object) -> bool:
        if not isinstance(answer, str):
            return False
        normalized_answer = normalize_text(answer)
        if not normalized_answer:
            return False

        expected = slide.get("expectedAnswer")
        if isinstance(expected, str) and normalize_text(expected) == normalized_answer:
            return True

        return False

    def _is_correct_true_false(self, slide: dict, answer: object) -> bool:
        correct_value = slide.get("correctValue")
        if not isinstance(correct_value, bool):
            return False

        if isinstance(answer, bool):
            return answer is correct_value

        if isinstance(answer, str):
            lowered = answer.strip().lower()
            if lowered in {"true", "vrai", "1", "yes"}:
                return correct_value is True
            if lowered in {"false", "faux", "0", "no"}:
                return correct_value is False
        return False
