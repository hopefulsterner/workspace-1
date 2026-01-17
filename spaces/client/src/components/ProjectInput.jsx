import { useState } from 'react'
import './ProjectInput.css'

const TECH_STACKS = [
  { id: 'auto', name: 'Auto-detect', icon: '🤖' },
  { id: 'vanilla-js', name: 'HTML/CSS/JS', icon: '🌐' },
  { id: 'react', name: 'React', icon: '⚛️' },
  { id: 'vue', name: 'Vue', icon: '💚' },
  { id: 'node-express', name: 'Node.js API', icon: '🟢' },
  { id: 'python-flask', name: 'Python Flask', icon: '🐍' }
]

const EXAMPLE_PROMPTS = [
  "Create a todo app with local storage",
  "Build a portfolio website with dark mode",
  "Create a REST API for a blog with CRUD operations",
  "Build a weather app that shows current conditions",
  "Create a landing page for a SaaS product"
]

function ProjectInput({ onGenerate, onModify, isGenerating, hasProject }) {
  const [prompt, setPrompt] = useState('')
  const [techStack, setTechStack] = useState('auto')
  const [isModifying, setIsModifying] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return

    if (isModifying && hasProject) {
      onModify(prompt.trim())
    } else {
      const options = {
        techStack: techStack !== 'auto' ? techStack : undefined
      }
      onGenerate(prompt.trim(), options)
    }
  }

  const handleExampleClick = (example) => {
    setPrompt(example)
  }

  return (
    <div className="project-input">
      <div className="input-header">
        <h2>{isModifying ? '🔄 Modify Project' : '✨ Generate New Project'}</h2>
        {hasProject && (
          <button 
            className="toggle-mode"
            onClick={() => setIsModifying(!isModifying)}
          >
            {isModifying ? '➕ New Project' : '🔄 Modify Current'}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="prompt-container">
          <textarea
            className="prompt-input"
            placeholder={isModifying 
              ? "Describe the changes you want (e.g., 'Add dark mode', 'Include user authentication')"
              : "Describe the project you want to create (e.g., 'Create a todo app with authentication and dark mode')"
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            maxLength={5000}
          />
          <span className="char-count">{prompt.length}/5000</span>
        </div>

        {!isModifying && (
          <div className="tech-stack-selector">
            <label>Tech Stack:</label>
            <div className="stack-options">
              {TECH_STACKS.map(stack => (
                <button
                  key={stack.id}
                  type="button"
                  className={`stack-option ${techStack === stack.id ? 'selected' : ''}`}
                  onClick={() => setTechStack(stack.id)}
                >
                  <span className="stack-icon">{stack.icon}</span>
                  <span className="stack-name">{stack.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button 
          type="submit" 
          className="generate-btn"
          disabled={!prompt.trim() || isGenerating}
        >
          {isGenerating ? (
            <>
              <span className="spinner"></span>
              {isModifying ? 'Modifying...' : 'Generating...'}
            </>
          ) : (
            <>
              {isModifying ? '🔄 Apply Changes' : '🚀 Generate Project'}
            </>
          )}
        </button>
      </form>

      {!isModifying && !hasProject && (
        <div className="examples">
          <p>Try an example:</p>
          <div className="example-list">
            {EXAMPLE_PROMPTS.map((example, index) => (
              <button
                key={index}
                className="example-btn"
                onClick={() => handleExampleClick(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectInput
