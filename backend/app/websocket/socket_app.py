import socketio

from app.config import settings
from app.database.mongo import get_database
from app.utils.security import decode_access_token
from app.websocket.room_manager import room_manager


sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[settings.frontend_url],
)


def _extract_room_code(payload: dict) -> str:
    room_code = payload.get("roomCode")
    if not isinstance(room_code, str) or not room_code.strip():
        raise ValueError("roomCode is required")
    return room_code.strip().upper()


async def _emit_error(sid: str, message: str) -> None:
    await sio.emit("error", {"message": message}, to=sid)


@sio.event
async def connect(sid: str, environ: dict, auth: dict | None = None):
    token = (auth or {}).get("token")
    if token:
        try:
            payload = decode_access_token(token)
            user_id = payload.get("sub")
            if isinstance(user_id, str):
                room_manager.set_authenticated_user(sid, user_id)
        except ValueError:
            await _emit_error(sid, "Invalid host token")


@sio.event
async def disconnect(sid: str):
    await room_manager.player_leave_room(sio, get_database(), sid)
    room_manager.clear_connection(sid)


@sio.on("host:join_room")
async def host_join_room(sid: str, payload: dict):
    try:
        return await room_manager.host_join_room(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("player:join_room")
async def player_join_room(sid: str, payload: dict):
    try:
        user_id = room_manager.get_authenticated_user_id(sid)
        if not user_id:
            raise ValueError("Authentication required")
        return await room_manager.player_join_room(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
            str(payload.get("nickname", "")),
            user_id,
        )
    except ValueError as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("player:rejoin_room")
async def player_rejoin_room(sid: str, payload: dict):
    try:
        user_id = room_manager.get_authenticated_user_id(sid)
        if not user_id:
            raise ValueError("Authentication required")
        player_id = payload.get("playerId")
        if not isinstance(player_id, str) or not player_id.strip():
            raise ValueError("playerId is required")
        return await room_manager.player_rejoin_room(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
            player_id.strip(),
            user_id,
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("player:leave_room")
async def player_leave_room(sid: str, payload: dict | None = None):
    await room_manager.player_leave_room(sio, get_database(), sid)
    return {"ok": True}


@sio.on("player:submit_answer")
async def player_submit_answer(sid: str, payload: dict):
    try:
        slide_id = payload.get("slideId")
        player_id = payload.get("playerId")
        if not isinstance(slide_id, str) or not isinstance(player_id, str):
            raise ValueError("slideId and playerId are required")

        return await room_manager.submit_answer(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
            slide_id,
            player_id,
            payload.get("answer"),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:start_quiz")
async def host_start_quiz(sid: str, payload: dict):
    try:
        return await room_manager.start_quiz(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:next_slide")
async def host_next_slide(sid: str, payload: dict):
    try:
        return await room_manager.next_slide(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:prev_slide")
async def host_prev_slide(sid: str, payload: dict):
    try:
        return await room_manager.prev_slide(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:lock_answers")
async def host_lock_answers(sid: str, payload: dict):
    try:
        return await room_manager.lock_answers(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:start_reveal")
async def host_start_reveal(sid: str, payload: dict):
    try:
        return await room_manager.start_reveal(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:reveal_slide")
async def host_reveal_slide(sid: str, payload: dict):
    try:
        return await room_manager.reveal_slide(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:next_reveal_slide")
async def host_next_reveal_slide(sid: str, payload: dict):
    try:
        return await room_manager.next_reveal_slide(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:prev_reveal_slide")
async def host_prev_reveal_slide(sid: str, payload: dict):
    try:
        return await room_manager.prev_reveal_slide(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:validate_reveal_slide")
async def host_validate_reveal_slide(sid: str, payload: dict):
    try:
        return await room_manager.validate_reveal_slide(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:override_answer_validation")
async def host_override_answer_validation(sid: str, payload: dict):
    try:
        answer_id = payload.get("answerId")
        is_correct = payload.get("isCorrect")
        if not isinstance(answer_id, str) or not answer_id.strip():
            raise ValueError("answerId is required")
        if not isinstance(is_correct, bool):
            raise ValueError("isCorrect must be a boolean")
        points_awarded = payload.get("pointsAwarded")
        if points_awarded is not None and (
            isinstance(points_awarded, bool) or not isinstance(points_awarded, (int, float))
        ):
            raise ValueError("pointsAwarded must be a number")

        return await room_manager.override_answer_validation(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
            answer_id.strip(),
            is_correct,
            float(points_awarded) if points_awarded is not None else None,
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:finish_quiz")
async def host_finish_quiz(sid: str, payload: dict):
    try:
        return await room_manager.finish_quiz(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:reset_session")
async def host_reset_session(sid: str, payload: dict):
    try:
        return await room_manager.reset_session(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


def _extract_audio_position(payload: dict) -> float:
    position = payload.get("position")
    if not isinstance(position, (int, float)) or position < 0:
        raise ValueError("position must be a non-negative number")
    return float(position)


def _extract_canvas_element_id(payload: dict) -> str:
    element_id = payload.get("elementId")
    if not isinstance(element_id, str) or not element_id.strip():
        raise ValueError("elementId is required")
    return element_id.strip()


@sio.on("host:audio_play")
async def host_audio_play(sid: str, payload: dict):
    try:
        return await room_manager.audio_control(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
            action="play",
            position=_extract_audio_position(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:audio_pause")
async def host_audio_pause(sid: str, payload: dict):
    try:
        return await room_manager.audio_control(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
            action="pause",
            position=_extract_audio_position(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:audio_seek")
async def host_audio_seek(sid: str, payload: dict):
    try:
        return await room_manager.audio_control(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
            action="seek",
            position=_extract_audio_position(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}


@sio.on("host:canvas_element_hide")
async def host_canvas_element_hide(sid: str, payload: dict):
    try:
        return await room_manager.canvas_element_hide(
            sio,
            get_database(),
            sid,
            _extract_room_code(payload),
            element_id=_extract_canvas_element_id(payload),
        )
    except (PermissionError, ValueError) as error:
        await _emit_error(sid, str(error))
        return {"ok": False, "error": str(error)}
