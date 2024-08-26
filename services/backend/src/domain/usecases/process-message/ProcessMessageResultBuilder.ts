import { MessageUsageMetric } from '@/domain/entities/message';
import { Stage1Output } from './schemas/stage_1';
import { Stage2Output } from './schemas/stage_2';
import { ProcessMessageResult } from './process-message.types';

export class ProcessMessageResultBuilder {
  private result: ProcessMessageResult;

  constructor() {
    this.result = {
      isError: false,
      additionalMessages: [],
      message: '',
      intermediates: {
        stage1Output: undefined,
        stage2Output: undefined,
      },
      actionsTaken: [],
      usageMetrics: [],
    };
  }

  setIsError(isError: boolean): ProcessMessageResultBuilder {
    this.result.isError = isError;
    return this;
  }

  addAdditionalMessage(message: string): ProcessMessageResultBuilder {
    this.result.additionalMessages.push(message);
    return this;
  }

  setMessage(message: string): ProcessMessageResultBuilder {
    this.result.message = message;
    return this;
  }

  setStage1Output(output: Stage1Output): ProcessMessageResultBuilder {
    this.result.intermediates.stage1Output = output;
    return this;
  }

  setStage2Output(output: Stage2Output): ProcessMessageResultBuilder {
    this.result.intermediates.stage2Output = output;
    return this;
  }

  addActionTaken(action: string): ProcessMessageResultBuilder {
    this.result.actionsTaken.push(action);
    return this;
  }

  addUsageMetric(metric: MessageUsageMetric): ProcessMessageResultBuilder {
    this.result.usageMetrics.push(metric);
    return this;
  }

  build(): ProcessMessageResult {
    return this.result;
  }
}
