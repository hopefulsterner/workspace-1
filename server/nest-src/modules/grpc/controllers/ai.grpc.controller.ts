import { Controller } from '@nestjs/common';
import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';
import { Observable, Subject } from 'rxjs';
import { AIService } from '../../ai/ai.service';

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface ChatChunk {
  content: string;
  done: boolean;
}

interface CodeGenerationRequest {
  prompt: string;
  language: string;
  framework: string;
  provider: string;
  model: string;
}

interface CodeGenerationResponse {
  success: boolean;
  files: Array<{ path: string; content: string; language: string }>;
  explanation: string;
}

interface ProvidersResponse {
  providers: string[];
}

interface CodeAnalysisRequest {
  code: string;
  language: string;
  checks: string[];
}

interface CodeAnalysisResponse {
  issues: Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    rule: string;
    suggestion: string;
  }>;
  score: number;
  summary: string;
}

@Controller()
export class AIGrpcController {
  constructor(private readonly aiService: AIService) {}

  @GrpcMethod('AIService', 'GenerateCode')
  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse> {
    try {
      const response = await this.aiService.chat({
        messages: [
          {
            role: 'user',
            content: `Generate ${request.language} code using ${request.framework}: ${request.prompt}`,
          },
        ],
        provider: request.provider,
        model: request.model,
      });

      // Parse file tags from response
      const files: Array<{ path: string; content: string; language: string }> = [];
      const fileRegex = /<file_create path="([^"]+)">([\s\S]*?)<\/file_create>/g;
      let match;
      
      while ((match = fileRegex.exec(response)) !== null) {
        files.push({
          path: match[1],
          content: match[2].trim(),
          language: request.language,
        });
      }

      return {
        success: true,
        files,
        explanation: response.replace(fileRegex, '').trim(),
      };
    } catch (error) {
      return {
        success: false,
        files: [],
        explanation: (error as Error).message,
      };
    }
  }

  @GrpcStreamMethod('AIService', 'StreamChat')
  streamChat(request: ChatRequest): Observable<ChatChunk> {
    const subject = new Subject<ChatChunk>();

    (async () => {
      try {
        for await (const chunk of this.aiService.streamChat({
          messages: request.messages as any,
          provider: request.provider,
          model: request.model,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
        })) {
          subject.next({ content: chunk, done: false });
        }
        subject.next({ content: '', done: true });
        subject.complete();
      } catch (error) {
        subject.error(error);
      }
    })();

    return subject.asObservable();
  }

  @GrpcMethod('AIService', 'GetProviders')
  getProviders(): ProvidersResponse {
    return {
      providers: this.aiService.getAvailableProviders(),
    };
  }

  @GrpcMethod('AIService', 'AnalyzeCode')
  async analyzeCode(request: CodeAnalysisRequest): Promise<CodeAnalysisResponse> {
    try {
      const response = await this.aiService.chat({
        messages: [
          {
            role: 'user',
            content: `Analyze this ${request.language} code for ${request.checks.join(', ')} issues. Return a JSON response with issues array containing severity, message, line, column, rule, suggestion. Also include score (0-100) and summary.\n\nCode:\n${request.code}`,
          },
        ],
      });

      // Try to parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          issues: parsed.issues || [],
          score: parsed.score || 0,
          summary: parsed.summary || '',
        };
      }

      return {
        issues: [],
        score: 0,
        summary: response,
      };
    } catch (error) {
      return {
        issues: [],
        score: 0,
        summary: (error as Error).message,
      };
    }
  }
}
