import { useState, useEffect, useCallback } from 'react'
import { listProjects, getProject } from '../services/api'
import './ProjectList.css'

function ProjectList({ onSelectProject }) {
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadProjects = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const data = await listProjects()
      setProjects(data)
    } catch (err) {
      setError(err.message || 'Failed to load projects')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  async function handleSelect(projectSummary) {
    try {
      const project = await getProject(projectSummary.id)
      onSelectProject(project)
    } catch (err) {
      setError(err.message || 'Failed to load project')
    }
  }

  if (isLoading) {
    return (
      <div className="project-list loading">
        <div className="loading-spinner"></div>
        <p>Loading projects...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="project-list error">
        <p>⚠️ {error}</p>
        <button onClick={loadProjects}>Try Again</button>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="project-list empty">
        <span className="empty-icon">📁</span>
        <h3>No projects yet</h3>
        <p>Generate your first project to see it here</p>
      </div>
    )
  }

  return (
    <div className="project-list">
      <div className="list-header">
        <h2>📁 Project History</h2>
        <p>{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
      </div>
      
      <div className="projects-grid">
        {projects.map(project => (
          <div 
            key={project.id} 
            className="project-card"
            onClick={() => handleSelect(project)}
          >
            <h3>{project.name}</h3>
            <p>{project.description}</p>
            <div className="card-footer">
              {project.techStack && (
                <span className="badge">{project.techStack}</span>
              )}
              <span className="date">
                {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProjectList
