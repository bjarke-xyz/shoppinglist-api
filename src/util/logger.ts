import { Context } from "hono";
import { getUserInfoOptional } from "../api/auth";
import { getRequestId } from "../api/middleware";

export function getLogger(name: string): Logger {
  return new Logger({ name });
}

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export class Logger {
  constructor(private readonly context: LogContext) {}

  public withContext(context: Context): Logger {
    const userInfo = getUserInfoOptional(context);
    const requestId = getRequestId(context);
    return new Logger({
      ...this.context,
      userId: userInfo?.sub,
      requestId: requestId,
    });
  }

  private format(data: LogData): string {
    return `${data.level} | msg=${data.message} name=${
      this.context.name ?? ""
    } user=${this.context.userId ?? ""} request-id=${
      this.context.requestId ?? ""
    }`;
  }

  public log(level: LogLevel, message?: any, ...optionalParams: any[]) {
    const formattedMsg = this.format({ level, message });
    if (optionalParams.length > 0) {
      console.log(formattedMsg, optionalParams);
    } else {
      console.log(formattedMsg);
    }
  }

  public info(message?: any, ...optionalParams: any[]) {
    return this.log("INFO", message, ...optionalParams);
  }

  public error(message?: any, ...optionalParams: any[]) {
    return this.log("ERROR", message, ...optionalParams);
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
