import { userInfoStore } from "../api/auth";
import { requestIdStore } from "../api/middleware";

export function getLogger(name: string): Logger {
  return new Logger({ name });
}

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export class Logger {
  constructor(private readonly context: LogContext) {}

  public withContext(): Logger {
    const requestId = requestIdStore.getStore();
    const userInfo = userInfoStore.getStore();
    return new Logger({
      ...this.context,
      requestId: requestId,
      userId: userInfo?.sub,
    });
  }

  private format(data: LogData): string {
    return `${data.level} | msg=${data.message} | name=${
      this.context.name ?? ""
    }`;
  }

  public log(level: LogLevel, message?: any, ...optionalParams: any[]) {
    const formattedMsg = this.format({ level, message });
    optionalParams.push({ name: this.context.name });
    if (this.context.requestId) {
      optionalParams.push({ requestId: this.context.requestId });
    }
    if (this.context.userId) {
      optionalParams.push({ userId: this.context.userId });
    }
    console.log(formattedMsg, JSON.stringify(optionalParams));
  }

  public info(message?: any, ...optionalParams: any[]) {
    return this.withContext().log("INFO", message, ...optionalParams);
  }

  public error(message?: any, ...optionalParams: any[]) {
    return this.withContext().log("ERROR", message, ...optionalParams);
  }
}

interface LogData {
  level: LogLevel;
  message: string;
}

interface LogContext {
  name: string;
  userId?: string | undefined;
  requestId?: string | undefined;
}
