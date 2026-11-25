import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { questionBank } from './data/questions'

const STORAGE_KEY = 'team-trivia-game-v1'
const categories = ['General Knowledge', 'Technology', 'Sports', 'Music & Entertainment', 'Geography & History', 'Science']
const fresh = () => ({ status: 'setup', teams: [], rounds: 5, seconds: 60, points: 10, round: 1, teamIndex: 0, scores: {}, history: [], usedQuestions: [], currentQuestion: null, timerEnabled: true, remaining: 60, timerRunning: false, answerRevealed: false, menuOpen: false, setup: null })

function App() {
  const [game, setGame] = useState(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY); return saved ? { ...fresh(), ...JSON.parse(saved) } : fresh() }
    catch { return fresh() }
  })
  const [setupTeams, setSetupTeams] = useState(4)
  const [nameMode, setNameMode] = useState('letters')
  const [names, setNames] = useState(['','','','','','','',''])
  const [setupRounds, setSetupRounds] = useState(5)
  const [setupSeconds, setSetupSeconds] = useState(60)
  const [setupPoints, setSetupPoints] = useState(10)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [notice, setNotice] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(game)) }, [game])

  const teams = game.teams || []
  const currentTeam = teams[game.teamIndex]
  const totalTurns = teams.length * game.rounds
  const completedTurns = game.history.length
  const leaderboard = useMemo(() => teams.map((team, i) => ({
    ...team, score: (game.scores[team.id] || []).reduce((sum, n) => sum + (typeof n === 'number' && n > 0 ? n : 0), 0), original: i
  })).sort((a,b) => b.score - a.score || a.original - b.original), [teams, game.scores])

  const update = (patch) => setGame(prev => ({ ...prev, ...patch }))
  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
  }, [])

  useEffect(() => {
    if (game.status !== 'playing' || !game.timerRunning || !game.timerEnabled || game.answerRevealed) { stopTimer(); return }
    intervalRef.current = setInterval(() => {
      setGame(prev => {
        if (!prev.timerRunning || !prev.timerEnabled || prev.status !== 'playing') return prev
        const next = Math.max(0, prev.remaining - 1)
        if (next === 0) return { ...prev, remaining: 0, timerRunning: false }
        return { ...prev, remaining: next }
      })
    }, 1000)
    return stopTimer
  }, [game.timerRunning, game.timerEnabled, game.status, game.answerRevealed, stopTimer])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return
      if (e.key.toLowerCase() === 'p' && (game.status === 'playing' || game.status === 'paused')) update({ status: game.status === 'paused' ? 'playing' : 'paused', timerRunning: false })
      if (e.key === 'Escape' && game.status !== 'setup') update({ menuOpen: !game.menuOpen })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game.status, game.menuOpen])

  const startNewGame = () => {
    const count = Math.max(2, Math.min(12, Number(setupTeams) || 2))
    const newTeams = Array.from({ length: count }, (_, i) => ({
      id: `team-${i+1}`, name: nameMode === 'custom' && names[i].trim() ? names[i].trim() : `Team ${String.fromCharCode(65+i)}`
    }))
    const scoreMap = Object.fromEntries(newTeams.map(t => [t.id, Array(Number(setupRounds) || 5).fill(null)]))
    setGame({ ...fresh(), status: 'playing', teams: newTeams, rounds: Number(setupRounds) || 5, seconds: Number(setupSeconds) || 60, points: Number(setupPoints) || 10, scores: scoreMap, remaining: Number(setupSeconds) || 60, setup: { nameMode } })
  }

  const beginQuestion = (category) => {
    const candidates = questionBank.filter(q => q.category === category && !game.usedQuestions.includes(q.id))
    if (!candidates.length) { setNotice(`No unused ${category} questions remain.`); return }
    const chosen = candidates[Math.floor(Math.random() * candidates.length)]
    update({ currentQuestion: chosen, selectedCategory: category, remaining: game.seconds, timerRunning: false, timerEnabled: true, answerRevealed: false, status: 'playing', menuOpen: false })
    setNotice('')
  }

  const startTimer = () => update({ timerRunning: true, status: 'playing' })
  const pauseTimer = () => update({ timerRunning: false })
  const resetTimer = () => update({ remaining: game.seconds, timerRunning: false })
  const reveal = () => update({ answerRevealed: true, timerRunning: false })

  const recordResult = (result) => {
    if (!game.currentQuestion || !currentTeam) return
    const score = result === 'correct' ? game.points : 0
    const scoreCell = result === 'pass' ? -1 : score
    const existing = game.scores[currentTeam.id] || Array(game.rounds).fill(null)
    const scores = { ...game.scores, [currentTeam.id]: existing.map((v,i) => i === game.round - 1 ? scoreCell : v) }
    const entry = { teamId: currentTeam.id, teamName: currentTeam.name, round: game.round, questionId: game.currentQuestion.id, category: game.currentQuestion.category, question: game.currentQuestion.question, answer: game.currentQuestion.answer, result, score, at: new Date().toISOString() }
    const nextHistory = [...game.history, entry]
    const nextTurn = game.teamIndex + 1
    const finishedRound = nextTurn >= teams.length
    const isFinished = finishedRound && game.round >= game.rounds
    update({
      scores, history: nextHistory, usedQuestions: [...game.usedQuestions, game.currentQuestion.id],
      currentQuestion: null, selectedCategory: '', answerRevealed: false, timerRunning: false,
      remaining: game.seconds, teamIndex: finishedRound ? 0 : nextTurn,
      round: finishedRound ? Math.min(game.round + 1, game.rounds) : game.round,
      status: isFinished ? 'completed' : 'playing', menuOpen: false
    })
  }

  const continueAfterMenu = () => update({ status: 'playing', menuOpen: false })
  const fullReset = () => { if (window.confirm('Start a new game? The current game will be replaced.')) { localStorage.removeItem(STORAGE_KEY); setGame(fresh()); setNotice('') } }
  const remainingQuestions = questionBank.length - game.usedQuestions.length

  if (game.status === 'setup') return <main className="setup-page">
    <div className="setup-card">
      <div className="brand-mark">TT</div>
      <p className="eyebrow">THE LIVE KNOWLEDGE CHALLENGE</p>
      <h1>Team <span>Trivia</span></h1>
      <p className="muted intro">Set up your teams, choose the rules, and get the room thinking.</p>
      <div className="form-grid">
        <label>Number of teams <strong>{setupTeams}</strong><input type="range" min="2" max="12" value={setupTeams} onChange={e=>setSetupTeams(+e.target.value)}/></label>
        <label>Team identification<select value={nameMode} onChange={e=>setNameMode(e.target.value)}><option value="letters">Use Team A, Team B...</option><option value="custom">Enter team names</option></select></label>
        {nameMode === 'custom' && <div className="team-name-grid">{Array.from({length:setupTeams},(_,i)=><label key={i}>Team {i+1}<input value={names[i] || ''} placeholder={`Team ${String.fromCharCode(65+i)}`} onChange={e=>setNames(old=>old.map((v,j)=>j===i?e.target.value:v))}/></label>)}</div>}
        <label>Number of rounds<input type="number" min="1" max="20" value={setupRounds} onChange={e=>setSetupRounds(+e.target.value)}/></label>
        <label>Answer time (seconds)<input type="number" min="0" max="600" value={setupSeconds} onChange={e=>setSetupSeconds(+e.target.value)}/><small>Enter 0 for unlimited time.</small></label>
        <label>Points for a correct answer<input type="number" min="1" max="100" value={setupPoints} onChange={e=>setSetupPoints(+e.target.value)}/></label>
      </div>
      <div className="rule-note"><b>Game rules</b><span>Correct: {setupPoints} points · Incorrect: 0 · Pass: 0 · No stealing</span><span>All six categories will be available.</span></div>
      <button className="primary wide" onClick={startNewGame}>Start game <span>→</span></button>
      <p className="tiny muted">60 questions · 6 categories · Progress saves automatically on this device.</p>
    </div>
  </main>

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark small">TT</div><div><b>TEAM TRIVIA</b><small>THE LIVE KNOWLEDGE CHALLENGE</small></div></div>
      <div className="top-meta"><span className={`status-dot ${game.status === 'paused' ? 'paused' : ''}`}></span>{game.status === 'completed' ? 'GAME COMPLETE' : game.status === 'paused' ? 'PAUSED' : 'LIVE GAME'}<button className="menu-button" onClick={()=>update({menuOpen:!game.menuOpen})}>☰ <span>Menu</span></button></div>
    </header>

    {game.menuOpen && <div className="menu-overlay"><div className="menu-card"><div className="menu-head"><h2>Game menu</h2><button className="icon-button" onClick={()=>update({menuOpen:false})}>✕</button></div>
      <button className="menu-item" onClick={()=>update({status:'paused',timerRunning:false,menuOpen:false})}>Ⅱ &nbsp; Pause game</button>
      <button className="menu-item" onClick={()=>{update({status:'paused',timerRunning:false,menuOpen:false});setShowSettings(true)}}>⚙ &nbsp; Game settings</button>
      <button className="menu-item" onClick={()=>update({menuOpen:false,showLeaderboard:true})}>▤ &nbsp; View full leaderboard</button>
      <button className="menu-item" onClick={()=>update({status:'playing',menuOpen:false})}>▶ &nbsp; Resume game</button>
      <button className="menu-item danger-text" onClick={fullReset}>＋ &nbsp; New game</button>
      <p className="tiny muted">Shortcut: P to pause/resume · Esc to open/close menu</p>
    </div></div>}

    {game.status === 'paused' && <div className="pause-banner"><b>Game paused</b><span>The game is on hold. Take your break or make an announcement.</span><button className="primary" onClick={()=>update({status:'playing',menuOpen:false})}>Resume game</button></div>}

    {game.status === 'completed' ? <section className="completion-panel">
      <div className="trophy">🏆</div><p className="eyebrow">FINAL RESULTS</p><h1>That's a wrap!</h1><p className="muted">Congratulations to our winning team.</p>
      <div className="final-rankings">{leaderboard.map((t,i)=><div className="rank-row" key={t.id}><span className="rank-number">{i+1}</span><b>{t.name}</b><strong>{t.score} pts</strong></div>)}</div>
      {leaderboard[0] && <div className="winner-callout">CHAMPIONS <strong>{leaderboard[0].name}</strong></div>}
      <button className="primary" onClick={fullReset}>Start a new game</button>
    </section> : <div className="game-layout">
      <aside className="score-panel">
        <div className="panel-heading"><div><p className="eyebrow">LIVE STANDINGS</p><h2>Leaderboard</h2></div><span className="live-pill">● LIVE</span></div>
        <div className="score-table-wrap"><table className="score-table"><thead><tr><th>TEAM</th>{Array.from({length:game.rounds},(_,i)=><th key={i}>R{i+1}</th>)}<th>TOTAL</th></tr></thead>
          <tbody>{teams.map(team=>{const vals=game.scores[team.id] || []; const total=vals.reduce((s,n)=>s+(typeof n==='number'?n:0),0);return <tr key={team.id} className={currentTeam?.id===team.id?'active-team':''}><td><span className="team-dot"></span>{team.name}</td>{Array.from({length:game.rounds},(_,i)=><td key={i}>{vals[i]===null||vals[i]===undefined?'—':vals[i]===-1?<span className="pass-mark">P</span>:vals[i]}</td>)}<td className="total-cell">{total}</td></tr>})}</tbody>
        </table></div>
        <div className="score-footer"><span>ROUND {Math.min(game.round,game.rounds)} OF {game.rounds}</span><span>{completedTurns}/{totalTurns} TURNS</span></div>
        <div className="progress-track"><div style={{width:`${totalTurns?completedTurns/totalTurns*100:0}%`}}/></div>
        <button className="subtle-button full" onClick={()=>update({showLeaderboard:true})}>View full leaderboard ↗</button>
      </aside>

      <section className="play-panel">
        {!game.currentQuestion ? <div className="category-stage">
          <div className="stage-kicker"><span className="stage-number">ROUND {game.round}</span><span>TEAM'S TURN</span></div>
          <p className="eyebrow">UP NEXT</p><h1>{currentTeam?.name || 'Next team'}</h1>
          <p className="muted">Ask the team to choose a category.</p>
          <div className="category-grid">{categories.map((cat,i)=><button key={cat} className={`category-tile tile-${i}`} onClick={()=>beginQuestion(cat)}><span className="category-icon">{['✦','⌘','⚽','♫','◎','⚗'][i]}</span><b>{cat}</b><small>Choose category</small></button>)}</div>
          <div className="question-bank-note"><span>{remainingQuestions} questions remaining</span><span>{game.usedQuestions.length} retired</span></div>
          {notice && <p className="notice">{notice}</p>}
        </div> : <div className="question-stage">
          <div className="stage-kicker"><span className="stage-number">ROUND {game.round}</span><span>{currentTeam?.name}</span><span className="category-label">{game.currentQuestion.category}</span></div>
          <div className="question-heading"><p className="eyebrow">YOUR QUESTION</p><span className="difficulty">{game.currentQuestion.difficulty}</span></div>
          <h1 className="question-text">{game.currentQuestion.question}</h1>
          <div className={`timer-box ${game.remaining<=10 && game.timerEnabled?'urgent':''}`}>
            <span className="timer-label">{game.timerEnabled?'TIME REMAINING':'TIMER DISABLED'}</span>
            <strong>{game.timerEnabled ? `${String(Math.floor(game.remaining/60)).padStart(2,'0')}:${String(game.remaining%60).padStart(2,'0')}` : '∞'}</strong>
            {game.timerEnabled && <div className="timer-track"><div style={{width:`${game.seconds?game.remaining/game.seconds*100:0}%`}}/></div>}
            {game.timerEnabled && <div className="timer-controls">
              {!game.timerRunning && game.remaining>0 && !game.answerRevealed && <button className="primary" onClick={startTimer}>{game.remaining===game.seconds?'▶ Start answering':'▶ Resume timer'}</button>}
              {game.timerRunning && <button className="secondary" onClick={pauseTimer}>Ⅱ Pause timer</button>}
              <button className="secondary" onClick={resetTimer}>↺ Reset</button>
              <button className="text-button" onClick={()=>update({timerEnabled:false,timerRunning:false})}>Disable timer</button>
            </div>}
            {!game.timerEnabled && <button className="secondary" onClick={()=>update({timerEnabled:true,remaining:game.seconds})}>Enable timer</button>}
            {game.timerEnabled && game.remaining===0 && <p className="time-up">Time is up — collect the team's answer.</p>}
          </div>
          {!game.answerRevealed ? <div className="review-row"><p className="muted">When the team gives its answer, reveal the official answer for judging.</p><button className="primary" onClick={reveal}>Reveal answer <span>→</span></button></div> :
            <div className="answer-review"><p className="eyebrow">OFFICIAL ANSWER · JUDGES REVIEW</p><h2>{game.currentQuestion.answer}</h2><p className="muted">Discuss and confirm whether the team's spoken answer is acceptable.</p><div className="result-buttons"><button className="result-correct" onClick={()=>recordResult('correct')}>✓ Correct <small>+{game.points} points</small></button><button className="result-wrong" onClick={()=>recordResult('incorrect')}>✕ Incorrect <small>0 points</small></button><button className="result-pass" onClick={()=>recordResult('pass')}>↷ Pass <small>0 points</small></button></div></div>}
        </div>}
      </section>
    </div>}

    {showSettings && <div className="menu-overlay"><div className="menu-card settings-modal"><div className="menu-head"><h2>Game settings</h2><button className="icon-button" onClick={()=>setShowSettings(false)}>✕</button></div>
      <label className="modal-label">Answer timer (seconds)<input type="number" min="0" max="600" value={game.seconds} onChange={e=>{const v=Math.max(0,Number(e.target.value)||0);update({seconds:v,remaining:v,timerRunning:false,timerEnabled:v>0})}}/><small>Set to 0 for unlimited time. Changes apply to the current question if one is active.</small></label>
      <label className="modal-label">Points for a correct answer<input type="number" min="1" max="100" value={game.points} onChange={e=>update({points:Math.max(1,Number(e.target.value)||1)})}/></label>
      <button className="primary wide" onClick={()=>setShowSettings(false)}>Save and return</button>
    </div></div>}
    {game.showLeaderboard && <div className="menu-overlay"><div className="menu-card leaderboard-modal"><div className="menu-head"><h2>Full leaderboard</h2><button className="icon-button" onClick={()=>update({showLeaderboard:false})}>✕</button></div>{leaderboard.map((t,i)=><div className="rank-row" key={t.id}><span className="rank-number">{i+1}</span><b>{t.name}</b><strong>{t.score} pts</strong></div>)}<button className="secondary wide" onClick={()=>update({showLeaderboard:false})}>Close</button></div></div>}
    <footer className="app-footer"><span>TEAM TRIVIA · LOCAL GAME</span><span>Autosave enabled · {remainingQuestions} questions available</span></footer>
  </main>
}
export default App
