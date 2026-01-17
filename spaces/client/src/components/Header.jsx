import './Header.css'

function Header({ view, onViewChange, onNewProject }) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo" onClick={onNewProject}>
          <span className="logo-icon">🚀</span>
          <h1>Spaces</h1>
        </div>
        
        <p className="tagline">AI-Powered Project Generator</p>

        <nav className="nav">
          <button 
            className={`nav-btn ${view === 'generate' ? 'active' : ''}`}
            onClick={() => onViewChange('generate')}
          >
            ✨ Generate
          </button>
          <button 
            className={`nav-btn ${view === 'history' ? 'active' : ''}`}
            onClick={() => onViewChange('history')}
          >
            📁 History
          </button>
        </nav>
      </div>
    </header>
  )
}

export default Header
