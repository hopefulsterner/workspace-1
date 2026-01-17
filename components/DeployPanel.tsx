import React, { useState } from 'react';
import { useStore } from '../store/useStore';

type DeployProvider = 'vercel' | 'railway' | 'netlify' | 'render' | 'fly' | 'heroku' | 'aws' | 'digitalocean' | null;

interface ProviderConfig {
  id: DeployProvider;
  name: string;
  icon: string;
  color: string;
  description: string;
  tokenLabel: string;
  tokenPlaceholder: string;
  docsUrl: string;
}

const providers: ProviderConfig[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    icon: '▲',
    color: 'from-black to-gray-800',
    description: 'Best for Next.js, React & frontend apps',
    tokenLabel: 'Vercel Token',
    tokenPlaceholder: 'Enter your Vercel API token',
    docsUrl: 'https://vercel.com/docs/rest-api#authentication',
  },
  {
    id: 'railway',
    name: 'Railway',
    icon: '🚂',
    color: 'from-purple-600 to-purple-800',
    description: 'Deploy apps, databases & cron jobs',
    tokenLabel: 'Railway Token',
    tokenPlaceholder: 'Enter your Railway API token',
    docsUrl: 'https://docs.railway.app/reference/public-api',
  },
  {
    id: 'netlify',
    name: 'Netlify',
    icon: '◆',
    color: 'from-teal-500 to-teal-700',
    description: 'Great for static sites & serverless',
    tokenLabel: 'Netlify Token',
    tokenPlaceholder: 'Enter your Netlify personal access token',
    docsUrl: 'https://docs.netlify.com/api/get-started/',
  },
  {
    id: 'render',
    name: 'Render',
    icon: '◉',
    color: 'from-emerald-500 to-emerald-700',
    description: 'Full-stack apps with managed databases',
    tokenLabel: 'Render API Key',
    tokenPlaceholder: 'Enter your Render API key',
    docsUrl: 'https://render.com/docs/api',
  },
  {
    id: 'fly',
    name: 'Fly.io',
    icon: '✈️',
    color: 'from-violet-500 to-violet-700',
    description: 'Deploy globally on edge servers',
    tokenLabel: 'Fly.io Token',
    tokenPlaceholder: 'Enter your Fly.io API token',
    docsUrl: 'https://fly.io/docs/flyctl/auth-token/',
  },
  {
    id: 'heroku',
    name: 'Heroku',
    icon: '⬡',
    color: 'from-indigo-500 to-indigo-700',
    description: 'Classic PaaS for web applications',
    tokenLabel: 'Heroku API Key',
    tokenPlaceholder: 'Enter your Heroku API key',
    docsUrl: 'https://devcenter.heroku.com/articles/authentication',
  },
  {
    id: 'aws',
    name: 'AWS Amplify',
    icon: '☁️',
    color: 'from-orange-500 to-orange-700',
    description: 'Full AWS integration & scalability',
    tokenLabel: 'AWS Access Key',
    tokenPlaceholder: 'Enter your AWS access key ID',
    docsUrl: 'https://docs.aws.amazon.com/amplify/',
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    icon: '🌊',
    color: 'from-blue-500 to-blue-700',
    description: 'Simple cloud for developers',
    tokenLabel: 'DO Token',
    tokenPlaceholder: 'Enter your DigitalOcean API token',
    docsUrl: 'https://docs.digitalocean.com/reference/api/',
  },
];

interface EnvVar {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
}

export const DeployPanel: React.FC = () => {
  const { theme } = useStore();
  const [selectedProvider, setSelectedProvider] = useState<DeployProvider>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [showAddEnvModal, setShowAddEnvModal] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [newEnvIsSecret, setNewEnvIsSecret] = useState(false);
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);

  const bgMain = theme === 'dark' ? 'bg-slate-900' : 'bg-white';
  const bgCard = theme === 'dark' ? 'bg-slate-800' : 'bg-gray-50';
  const bgCardHover = theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100';
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textSecondary = theme === 'dark' ? 'text-slate-300' : 'text-gray-600';
  const textMuted = theme === 'dark' ? 'text-slate-400' : 'text-gray-500';
  const borderColor = theme === 'dark' ? 'border-slate-700' : 'border-gray-200';
  const inputBg = theme === 'dark' ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300';

  const handleDeploy = async () => {
    if (!selectedProvider) return;
    
    const token = tokens[selectedProvider];
    if (!token) {
      alert('Please enter your API token first');
      return;
    }

    setDeploying(true);
    setDeployStatus('idle');

    // Simulate deployment
    setTimeout(() => {
      setDeploying(false);
      setDeployStatus('success');
      setTimeout(() => setDeployStatus('idle'), 3000);
    }, 2000);
  };

  const provider = providers.find(p => p.id === selectedProvider);

  // Provider selection view
  if (!selectedProvider) {
    return (
      <div className={`h-full flex flex-col ${bgMain}`}>
        {/* Header */}
        <div className={`px-4 py-3 border-b ${borderColor}`}>
          <h2 className={`text-lg font-semibold ${textPrimary}`}>Deploy Your App</h2>
          <p className={`text-sm ${textMuted} mt-1`}>Choose a platform to deploy your project</p>
        </div>

        {/* Provider Grid */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 gap-3">
            {providers.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                className={`flex items-center gap-4 p-4 rounded-xl ${bgCard} ${bgCardHover} border ${borderColor} transition-all duration-200 hover:scale-[1.02] hover:shadow-lg text-left group`}
              >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center text-white text-xl font-bold shadow-lg`}>
                  {p.icon}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold ${textPrimary}`}>{p.name}</h3>
                    <svg className={`w-4 h-4 ${textMuted} opacity-0 group-hover:opacity-100 transition-opacity`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <p className={`text-sm ${textMuted} truncate`}>{p.description}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Info Box */}
          <div className={`mt-6 p-4 rounded-xl ${theme === 'dark' ? 'bg-indigo-900/30 border-indigo-800' : 'bg-indigo-50 border-indigo-200'} border`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h4 className={`font-medium ${textPrimary}`}>Quick Tip</h4>
                <p className={`text-sm ${textMuted} mt-1`}>
                  You'll need an API token from your chosen platform. Each provider has free tiers perfect for getting started!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Provider detail view
  return (
    <div className={`h-full flex flex-col ${bgMain}`}>
      {/* Header with back button */}
      <div className={`px-4 py-3 border-b ${borderColor}`}>
        <button
          onClick={() => {
            setSelectedProvider(null);
            setDeployStatus('idle');
          }}
          className={`flex items-center gap-2 ${textMuted} hover:${textPrimary} transition-colors mb-2`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm">Back to providers</span>
        </button>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${provider?.color} flex items-center justify-center text-white text-lg font-bold shadow-lg`}>
            {provider?.icon}
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${textPrimary}`}>{provider?.name}</h2>
            <p className={`text-sm ${textMuted}`}>{provider?.description}</p>
          </div>
        </div>
      </div>

      {/* Deploy Form */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Status Messages */}
        {deployStatus === 'success' && (
          <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-emerald-900/30 border-emerald-800' : 'bg-emerald-50 border-emerald-200'} border flex items-center gap-3`}>
            <span className="text-2xl">✅</span>
            <div>
              <h4 className="font-medium text-emerald-500">Deployment Started!</h4>
              <p className={`text-sm ${textMuted}`}>Your app is being deployed. Check your dashboard for progress.</p>
            </div>
          </div>
        )}

        {deployStatus === 'error' && (
          <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-red-900/30 border-red-800' : 'bg-red-50 border-red-200'} border flex items-center gap-3`}>
            <span className="text-2xl">❌</span>
            <div>
              <h4 className="font-medium text-red-500">Deployment Failed</h4>
              <p className={`text-sm ${textMuted}`}>Please check your token and try again.</p>
            </div>
          </div>
        )}

        {/* Token Input */}
        <div className={`p-4 rounded-xl ${bgCard} border ${borderColor}`}>
          <label className={`block text-sm font-medium ${textPrimary} mb-2`}>
            {provider?.tokenLabel}
          </label>
          <input
            type="password"
            value={tokens[selectedProvider] || ''}
            onChange={(e) => setTokens({ ...tokens, [selectedProvider]: e.target.value })}
            placeholder={provider?.tokenPlaceholder}
            className={`w-full px-4 py-3 rounded-lg ${inputBg} ${textPrimary} border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all`}
          />
          <a
            href={provider?.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-indigo-500 hover:text-indigo-400 mt-2"
          >
            <span>How to get your token</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* Project Settings */}
        <div className={`p-4 rounded-xl ${bgCard} border ${borderColor}`}>
          <h3 className={`font-medium ${textPrimary} mb-3`}>Project Settings</h3>
          
          <div className="space-y-3">
            <div>
              <label className={`block text-sm ${textMuted} mb-1`}>Project Name</label>
              <input
                type="text"
                defaultValue="ai-digital-friend-zone"
                className={`w-full px-3 py-2 rounded-lg ${inputBg} ${textPrimary} border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm`}
              />
            </div>
            
            <div>
              <label className={`block text-sm ${textMuted} mb-1`}>Branch</label>
              <select className={`w-full px-3 py-2 rounded-lg ${inputBg} ${textPrimary} border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm`}>
                <option value="main">main</option>
                <option value="develop">develop</option>
                <option value="production">production</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm ${textMuted} mb-1`}>Build Command</label>
              <input
                type="text"
                defaultValue="npm run build"
                className={`w-full px-3 py-2 rounded-lg ${inputBg} ${textPrimary} border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono`}
              />
            </div>

            <div>
              <label className={`block text-sm ${textMuted} mb-1`}>Output Directory</label>
              <input
                type="text"
                defaultValue="dist"
                className={`w-full px-3 py-2 rounded-lg ${inputBg} ${textPrimary} border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono`}
              />
            </div>
          </div>
        </div>

        {/* Environment Variables */}
        <div className={`p-4 rounded-xl ${bgCard} border ${borderColor}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`font-medium ${textPrimary}`}>Environment Variables</h3>
            <button 
              onClick={() => {
                setShowAddEnvModal(true);
                setEditingEnvId(null);
                setNewEnvKey('');
                setNewEnvValue('');
                setNewEnvIsSecret(false);
              }}
              className="text-sm text-indigo-500 hover:text-indigo-400 font-medium"
            >
              + Add
            </button>
          </div>
          
          {envVars.length === 0 ? (
            <div className={`text-sm ${textMuted} text-center py-4`}>
              No environment variables added yet
            </div>
          ) : (
            <div className="space-y-2">
              {envVars.map((env) => (
                <div 
                  key={env.id} 
                  className={`flex items-center gap-2 p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-mono font-medium ${textPrimary}`}>{env.key}</span>
                      {env.isSecret && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500">secret</span>
                      )}
                    </div>
                    <span className={`text-xs font-mono ${textMuted} truncate block`}>
                      {env.isSecret ? '••••••••' : env.value}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setEditingEnvId(env.id);
                      setNewEnvKey(env.key);
                      setNewEnvValue(env.value);
                      setNewEnvIsSecret(env.isSecret);
                      setShowAddEnvModal(true);
                    }}
                    className={`p-1.5 rounded ${theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-gray-200'} transition-colors`}
                    title="Edit"
                  >
                    <svg className={`w-4 h-4 ${textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEnvVars(envVars.filter(e => e.id !== env.id))}
                    className={`p-1.5 rounded hover:bg-red-500/20 transition-colors`}
                    title="Delete"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add/Edit Environment Variable Modal */}
        {showAddEnvModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddEnvModal(false)}>
            <div 
              className={`w-full max-w-md mx-4 p-5 rounded-2xl ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}
              onClick={e => e.stopPropagation()}
            >
              <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
                {editingEnvId ? 'Edit Environment Variable' : 'Add Environment Variable'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm ${textMuted} mb-1`}>Variable Name</label>
                  <input
                    type="text"
                    value={newEnvKey}
                    onChange={(e) => setNewEnvKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                    placeholder="API_KEY"
                    className={`w-full px-3 py-2 rounded-lg ${inputBg} ${textPrimary} border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono`}
                  />
                </div>
                
                <div>
                  <label className={`block text-sm ${textMuted} mb-1`}>Value</label>
                  <input
                    type={newEnvIsSecret ? 'password' : 'text'}
                    value={newEnvValue}
                    onChange={(e) => setNewEnvValue(e.target.value)}
                    placeholder="Enter value..."
                    className={`w-full px-3 py-2 rounded-lg ${inputBg} ${textPrimary} border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono`}
                  />
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEnvIsSecret}
                    onChange={(e) => setNewEnvIsSecret(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className={`text-sm ${textSecondary}`}>Mark as secret (hide value)</span>
                </label>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddEnvModal(false)}
                  className={`flex-1 py-2 rounded-lg ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'} ${textPrimary} font-medium transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!newEnvKey.trim() || !newEnvValue.trim()) return;
                    
                    if (editingEnvId) {
                      // Update existing
                      setEnvVars(envVars.map(e => 
                        e.id === editingEnvId 
                          ? { ...e, key: newEnvKey, value: newEnvValue, isSecret: newEnvIsSecret }
                          : e
                      ));
                    } else {
                      // Add new
                      setEnvVars([...envVars, {
                        id: Date.now().toString(),
                        key: newEnvKey,
                        value: newEnvValue,
                        isSecret: newEnvIsSecret,
                      }]);
                    }
                    
                    setShowAddEnvModal(false);
                    setNewEnvKey('');
                    setNewEnvValue('');
                    setNewEnvIsSecret(false);
                    setEditingEnvId(null);
                  }}
                  disabled={!newEnvKey.trim() || !newEnvValue.trim()}
                  className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                    newEnvKey.trim() && newEnvValue.trim()
                      ? 'bg-indigo-500 hover:bg-indigo-600 text-white'
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  }`}
                >
                  {editingEnvId ? 'Update' : 'Add Variable'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Deploy Button */}
      <div className={`p-4 border-t ${borderColor}`}>
        <button
          onClick={handleDeploy}
          disabled={deploying || !tokens[selectedProvider]}
          className={`w-full py-3 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2
            ${deploying 
              ? 'bg-gray-500 cursor-not-allowed' 
              : tokens[selectedProvider]
                ? `bg-gradient-to-r ${provider?.color} hover:shadow-lg hover:scale-[1.02]`
                : 'bg-gray-500 cursor-not-allowed'
            }`}
        >
          {deploying ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Deploying...</span>
            </>
          ) : (
            <>
              <span>🚀</span>
              <span>Deploy to {provider?.name}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
