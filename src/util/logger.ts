export function getLogger(name: string): Logger {
  return new Logger(name);
}

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export class Logger {
  constructor(private readonly name: string) {}

  public log(level: LogLevel, message?: any, ...optionalParams: any[]) {
    console.log(`${level}: [${this.name}] ${message}`, ...optionalParams);
  }

  public info(message?: any, ...optionalParams: any[]) {
    return this.log("INFO", message, optionalParams);
  }

  public error(message?: any, ...optionalParams: any[]) {
    return this.log("ERROR", message, optionalParams);
  }
}
