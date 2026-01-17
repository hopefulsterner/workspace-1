// Pyodide - Python runtime in the browser
let pyodideInstance: any = null;
let isLoading = false;

declare global {
  interface Window {
    loadPyodide: (config?: { indexURL?: string }) => Promise<any>;
  }
}

export interface PythonResult {
  success: boolean;
  output: string;
  error?: string;
}

export const pyodideService = {
  // Load Pyodide runtime
  load: async (): Promise<any> => {
    if (pyodideInstance) {
      return pyodideInstance;
    }

    if (isLoading) {
      while (isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return pyodideInstance;
    }

    isLoading = true;

    try {
      // Load Pyodide script if not already loaded
      if (!window.loadPyodide) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Pyodide'));
          document.head.appendChild(script);
        });
      }

      console.log('🐍 Loading Pyodide...');
      pyodideInstance = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
      });

      // Set up stdout/stderr capture
      pyodideInstance.runPython(`
import sys
from io import StringIO

class OutputCapture:
    def __init__(self):
        self.stdout = StringIO()
        self.stderr = StringIO()
        
    def get_output(self):
        return self.stdout.getvalue()
    
    def get_error(self):
        return self.stderr.getvalue()
    
    def clear(self):
        self.stdout = StringIO()
        self.stderr = StringIO()

_output_capture = OutputCapture()
      `);

      console.log('✅ Pyodide loaded successfully!');
      return pyodideInstance;
    } catch (error) {
      console.error('❌ Failed to load Pyodide:', error);
      throw error;
    } finally {
      isLoading = false;
    }
  },

  // Check if Pyodide is loaded
  isLoaded: (): boolean => {
    return pyodideInstance !== null;
  },

  // Run Python code (alias for runPython with simpler return)
  run: async (code: string): Promise<{ output: string; error?: string; result?: any }> => {
    const result = await pyodideService.runPython(code);
    return {
      output: result.output,
      error: result.error,
      result: result.success ? undefined : undefined, // result is already in output
    };
  },

  // Install a single package (alias for installPackages)
  installPackage: async (packageName: string): Promise<void> => {
    const result = await pyodideService.installPackages([packageName]);
    if (!result.success) {
      throw new Error(result.error || 'Failed to install package');
    }
  },

  // Run Python code
  runPython: async (code: string): Promise<PythonResult> => {
    try {
      const pyodide = await pyodideService.load();

      // Capture stdout/stderr
      pyodide.runPython(`
import sys
from io import StringIO
_stdout_capture = StringIO()
_stderr_capture = StringIO()
_old_stdout = sys.stdout
_old_stderr = sys.stderr
sys.stdout = _stdout_capture
sys.stderr = _stderr_capture
      `);

      let result: any;
      try {
        result = await pyodide.runPythonAsync(code);
      } catch (error: any) {
        // Restore stdout/stderr
        pyodide.runPython(`
sys.stdout = _old_stdout
sys.stderr = _old_stderr
        `);
        
        return {
          success: false,
          output: '',
          error: error.message || String(error),
        };
      }

      // Get captured output
      const stdout = pyodide.runPython('_stdout_capture.getvalue()');
      const stderr = pyodide.runPython('_stderr_capture.getvalue()');

      // Restore stdout/stderr
      pyodide.runPython(`
sys.stdout = _old_stdout
sys.stderr = _old_stderr
      `);

      let output = stdout || '';
      if (result !== undefined && result !== null) {
        output += (output ? '\n' : '') + String(result);
      }

      return {
        success: true,
        output,
        error: stderr || undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message || String(error),
      };
    }
  },

  // Install Python packages
  installPackages: async (packages: string[]): Promise<PythonResult> => {
    try {
      const pyodide = await pyodideService.load();
      
      console.log(`📦 Installing Python packages: ${packages.join(', ')}`);
      
      await pyodide.loadPackage('micropip');
      const micropip = pyodide.pyimport('micropip');
      
      for (const pkg of packages) {
        await micropip.install(pkg);
        console.log(`✅ Installed ${pkg}`);
      }

      return {
        success: true,
        output: `Successfully installed: ${packages.join(', ')}`,
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message || String(error),
      };
    }
  },

  // Get list of installed packages
  getInstalledPackages: async (): Promise<string[]> => {
    try {
      const pyodide = await pyodideService.load();
      const result = pyodide.runPython(`
import sys
list(sys.modules.keys())
      `);
      return result.toJs();
    } catch {
      return [];
    }
  },

  // Reset the Python environment
  reset: async (): Promise<void> => {
    if (pyodideInstance) {
      pyodideInstance.runPython(`
# Clear all user-defined variables
for name in list(globals()):
    if not name.startswith('_'):
        del globals()[name]
      `);
    }
  },
};
