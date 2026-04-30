import type { RoomPlayer } from '../../types/room'

type ScoreboardProps = {
  title?: string
  players: RoomPlayer[]
  highlightPlayerId?: string
}

export function Scoreboard({ title = 'Scores', players, highlightPlayerId }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

  return (
    <section className="scoreboard">
      <h3>{title}</h3>
      {sorted.length ? (
        <div className="scoreboard-list">
          {sorted.map((player, index) => (
            <div
              className={
                player.playerId === highlightPlayerId
                  ? 'scoreboard-row scoreboard-row-highlight'
                  : 'scoreboard-row'
              }
              key={player.playerId}
            >
              <span className="scoreboard-rank">#{index + 1}</span>
              <span className="scoreboard-name">{player.nickname}</span>
              <strong className="scoreboard-score">{player.score ?? 0}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p>Aucun joueur pour le moment.</p>
      )}
    </section>
  )
}

