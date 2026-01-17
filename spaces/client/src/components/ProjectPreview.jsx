import { useState, useEffect } from 'react'
import { getFileContent } from '../services/api'
import './ProjectPreview.css'

function ProjectPreview({ project, isLoading }) {
  const [activeTab, setActiveTab] = useState('preview')
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)

  // Fetch file content when a file is selected
  useEffect(() => {
    if (selectedFile !== null && project?.files?.[selectedFile]) {
      const filePath = project.files[selectedFile].path
      setLoadingFile(true)
      getFileContent(project.id, filePath)
        .then(content => setFileContent(content))
        .catch(() => setFileContent('Failed to load file content'))
        .finally(() => setLoadingFile(false))
    }
  }, [selectedFile, project])

  // Reset selected file when project changes
  useEffect(() => {
    setSelectedFile(null)
    setFileContent('')
  }, [project?.id])

  if (isLoading) {
    return (
      <div className="project-preview loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h3>Generating your project...</h3>
          <p>AI is creating your complete project with all necessary files</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="project-preview empty">
        <div className="empty-content">
          <span className="empty-icon">🎨</span>
          <h3>Your project will appear here</h3>
          <p>Describe what you want to build, and AI will generate a complete working project for you.</p>
          <div className="feature-list">
            <div className="feature">
              <span>✨</span>
              <span>Complete project structure</span>
            </div>
            <div className="feature">
              <span>📦</span>
              <span>Download as ZIP</span>
            </div>
            <div className="feature">
              <span>👁️</span>
              <span>Live preview</span>
            </div>
            <div className="feature">
              <span>🔄</span>
              <span>Request modifications</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="project-preview">
      <div className="preview-header">
        <div className="project-info">
          <h3>{project.name}</h3>
          <p>{project.description}</p>
          <div className="badges">
            {project.techStack && (
              <span className="badge">{project.techStack}</span>
            )}
          </div>
        </div>
        
        <div className="actions">
          <a 
            href={project.downloadUrl} 
            className="action-btn download"
            download
          >
            📥 Download ZIP
          </a>
        </div>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          👁️ Preview
        </button>
        <button 
          className={`tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          📁 Files ({project.files?.length || 0})
        </button>
        <button 
          className={`tab ${activeTab === 'setup' ? 'active' : ''}`}
          onClick={() => setActiveTab('setup')}
        >
          📋 Setup
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'preview' && (
          <div className="preview-frame-container">
            <iframe
              className="preview-frame"
              src={project.previewUrl}
              title="Project Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}

        {activeTab === 'files' && (
          <div className="files-view">
            <div className="file-tree">
              {project.files?.map((file, index) => (
                <button
                  key={index}
                  className={`file-item ${selectedFile === index ? 'selected' : ''}`}
                  onClick={() => setSelectedFile(index)}
                >
                  <span className="file-icon">{getFileIcon(file.type)}</span>
                  <span className="file-name">{file.path}</span>
                </button>
              ))}
            </div>
            {selectedFile !== null && project.files?.[selectedFile] && (
              <div className="file-content">
                <div className="file-content-header">
                  <span>{project.files[selectedFile].path}</span>
                </div>
                <pre><code>{loadingFile ? 'Loading...' : fileContent}</code></pre>
              </div>
            )}
          </div>
        )}

        {activeTab === 'setup' && (
          <div className="setup-view">
            <h4>Setup Instructions</h4>
            <ol className="setup-steps">
              {project.setupInstructions?.map((step, index) => (
                <li key={index}>{step}</li>
              )) || <li>Download and extract the ZIP file</li>}
            </ol>
            
            {project.dependencies?.length > 0 && (
              <>
                <h4>Dependencies</h4>
                <ul className="dependencies">
                  {project.dependencies.map((dep, index) => (
                    <li key={index}><code>{dep}</code></li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function getFileIcon(type) {
  const icons = {
    'html': '🌐',
    'css': '🎨',
    'javascript': '📜',
    'typescript': '📘',
    'json': '📋',
    'markdown': '📝',
    'python': '🐍',
    'java': '☕',
    'go': '🔵',
    'rust': '🦀',
    'vue': '💚',
    'yaml': '⚙️',
    'text': '📄'
  }
  return icons[type] || '📄'
}

export default ProjectPreview
