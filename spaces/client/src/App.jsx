import { useState, useCallback } from 'react'
import Header from './components/Header'
import ProjectInput from './components/ProjectInput'
import ProjectPreview from './components/ProjectPreview'
import ProjectList from './components/ProjectList'
import { generateProject, modifyProject } from './services/api'
import './styles/App.css'
import './styles/global.css'

function App() {
  const [currentProject, setCurrentProject] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [view, setView] = useState('generate') // 'generate' | 'history'

  const handleGenerate = useCallback(async (prompt, options) => {
    setIsGenerating(true)
    setError(null)
    
    try {
      const project = await generateProject(prompt, options)
      setCurrentProject(project)
    } catch (err) {
      setError(err.message || 'Failed to generate project')
    } finally {
      setIsGenerating(false)
    }
  }, [])

  const handleModify = useCallback(async (modification) => {
    if (!currentProject) return
    
    setIsGenerating(true)
    setError(null)
    
    try {
      const project = await modifyProject(currentProject.id, modification)
      setCurrentProject(project)
    } catch (err) {
      setError(err.message || 'Failed to modify project')
    } finally {
      setIsGenerating(false)
    }
  }, [currentProject])

  const handleSelectProject = useCallback((project) => {
    setCurrentProject(project)
    setView('generate')
  }, [])

  const handleNewProject = useCallback(() => {
    setCurrentProject(null)
    setError(null)
  }, [])

  return (
    <div className="app">
      <Header 
        view={view} 
        onViewChange={setView}
        onNewProject={handleNewProject}
      />
      
      <main className="main-content">
        {view === 'generate' ? (
          <>
            <section className="input-section">
              <ProjectInput 
                onGenerate={handleGenerate}
                onModify={handleModify}
                isGenerating={isGenerating}
                hasProject={!!currentProject}
              />
              
              {error && (
                <div className="error-message">
                  <span>⚠️</span> {error}
                </div>
              )}
            </section>

            <section className="preview-section">
              <ProjectPreview 
                project={currentProject}
                isLoading={isGenerating}
              />
            </section>
          </>
        ) : (
          <section className="history-section">
            <ProjectList onSelectProject={handleSelectProject} />
          </section>
        )}
      </main>

      <footer className="footer">
        <p>Spaces AI Project Generator • Describe what you want, AI builds it</p>
      </footer>
    </div>
  )
}

export default App
