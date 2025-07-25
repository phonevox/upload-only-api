// https://github.com/adriankubinyete/logging-js
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const LEVELS = {
    critical: { level: 0, color: "bold red blackBG", ansi: "\x1b[1m"  },
    error: { level: 1, color: "red", ansi: "\x1b[31m" },
    warn: { level: 2, color: "yellow", ansi: "\x1b[33m" },
    info: { level: 3, color: "bold green", ansi: "\x1b[32m" },
    debug: { level: 4, color: "blue", ansi: "\x1b[34m" },
    trace: { level: 5, color: "cyan", ansi: "\x1b[36m" },
    unit: { level: 6, color: "bold cyan", ansi: "\x1b[36m" }, //
}

// map log colors to ansi codes
function getAnsiColor(colorString) {
    const colorMap = {
        bold: "\x1b[1m",
        blackBG: "\x1b[40m",
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        cyan: "\x1b[36m",
        reset: "\x1b[0m"
    }

    // Divide as cores (e.g., "bold red blackBG") e converte cada uma
    return colorString
        .split(" ")
        .map(color => colorMap[color] || "")
        .join("");
}

const shutup = new winston.transports.Console({
    level: 'silent',
    silent: true
})

class EasyConsole {
    constructor(options = { level: 'debug' }) {
        this.name = "EasyConsole";
        this.padding = 8;
        this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this.level = options.level;
    }

    gen(name) {
        return new winston.transports.Console({
            level: this.level,
            format: winston.format.combine(
                winston.format.label({ label: name }),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS', tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                winston.format.printf(info => {
                    const { timestamp, level, message, label } = info;
                    const color = getAnsiColor(LEVELS[level]?.color || "");
                    const paddedLevel = level.padEnd(8, ' ').toUpperCase();
                    const reset = "\x1b[0m";

                    return `[${timestamp}] [${color}${paddedLevel}${reset}] ${color}${label}: ${message}${reset}`;
                }),
            )
        })
    }
}

class EasyFileRotate {
    constructor(options = { filename: undefined, maxSize: undefined, maxFiles: undefined, level: 'debug' }) {
        this.name = "EasyFileRotate";
        this.padding = 8;
        this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this.filename = options.filename;
        this.maxSize = options.maxSize;
        this.maxFiles = options.maxFiles;
        this.level = options.level;
    }

    gen(name) {
        return new DailyRotateFile({
            filename: this.filename,
            datePattern: 'YYYYMMDD',
            zippedArchive: true,
            maxSize: this.maxSize,
            maxFiles: this.maxFiles,
            level: this.level,
            format: winston.format.combine(
                winston.format.uncolorize(),
                winston.format.label({ label: name }),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS', tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                winston.format.printf(({ level, message, label, timestamp }) => {
                    const paddedLevel = level.padEnd(this.padding, ' ').toUpperCase();
                    return `[${timestamp}] [${paddedLevel}] ${label}: ${message}`;
                }),
            ),
        });
    }
}

class Logger {
    constructor(builder, name) {
        this.builder = builder;
        this.name = name;
        this.transports = [];
        this.prefix = undefined;
        this.children = undefined;
        this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        this.padding = 8

        this.winston = winston.createLogger({
            levels: builder._getLevels(),
            level: 'debug',
            transports: [ shutup ],
        })

        // this allow us to do "logger.<info/debug/etc>('message')" and actually sends it to winston
        // function Logger.[LEVEL](message)
        for (const level in this.builder.levels) {
            this[level] = (...args) => {

                // iterate over args
                for (let i = 0; i < args.length; i++) {
                    const arg = args[i];

                    // pretty objects, arrays
                    if (typeof arg === 'object') {
                        args[i] = '\n'+JSON.stringify(arg, null, 2);
                        if (i < args.length - 1) args[i] += '\n'; // suffix newline if not last arg
                    }

                    // pretty functions
                    if (typeof arg === 'function') {
                        args[i] = '\n' + arg;
                        if (i < args.length - 1) args[i] += '\n'; // suffix newline if not last arg
                    }

                    // Check if the previous argument doesn't end with a newline
                    if (
                        i < args.length - 1 &&
                        !(String(args[i]).endsWith('\n') || (i > 0 && String(args[i - 1])?.endsWith('\n')))
                    ) {
                        args[i] += ' ';
                    }
                }

                let message = args.join('');
                if (this.prefix) message = this.prefix + " " + message; // add prefix if any

                this.winston[level](message); // do the actual logging
            }
        }
    }


    // ----------------------------------------------------------------------------------------------------
    // Propagators 

    // Propagate the transport to child logs (every log that is prefixed with "${this.name}." of our log)
    _propagateTransportToChilds(Transport) {
        this.children = this.builder.loggers.filter(logger => logger.name.startsWith(this.name + "."));
        for (const child of this.children) {
            child.addTransport(Transport); // add transport to it
        }
    }

    // This wont be implemented. I think it makes sense for the prefix to only affect the current log
    //_propagatePrefix(prefix) { return }

    // ----------------------------------------------------------------------------------------------------
    // Methods 

    setPrefix(prefix) {
        this.prefix = prefix;
        return this
    }

    addTransport(Transport) {
        // @NOTE(adrian): THIS line right here is what make us incompatible with winston formatters
        // and why we need custom transport "wrappers": we need to tell the formatter the name of the label
        // i dont know how to do this any other way. deal with it
        this.transports.push(Transport); // add transport to our log
        this.winston.add(Transport.gen(this.name)); // update our log
        this._propagateTransportToChilds(Transport); // propagate transport to child logs 
        return this
    }

}

class LogBuilder {
    constructor() {
        this.levels = {
            critical: { level: 0, color: "bold red blackBG" },
            error: { level: 1, color: "red" },
            warn: { level: 2, color: "yellow" },
            info: { level: 3, color: "bold green" },
            debug: { level: 4, color: "blue" },
            trace: { level: 5, color: "cyan" },
            unit: { level: 6, color: "bold cyan" }
        }

        // Active loggers
        this.loggers = [];

        // List quick transports
        this.transports = {
            Console: EasyConsole,
            FileRotate: EasyFileRotate
        }

        // Adding this.[LEVEL] consts to the class
        for (let level in this.levels) {
            this[level.toUpperCase()] = level;
        }    
    }

    // -------------------------------------------------

    _getLevels() {
        const levels = {};
        for (const key in this.levels) {
            levels[key] = this.levels[key].level;
        }
        return levels;
    }

    _getColors() {
        const colors = {};
        for (const key in this.levels) {
            colors[key] = this.levels[key].color;
        }
        return colors;

    }

    // -------------------------------------------------

    getLogger(name) {
        // check logger already exist
        let logger = this.loggers.find(logger => logger.name === name);
        if (logger) return logger;
    
        // create new logger
        logger = new Logger(this, name);
    
        // check if theres a parent log with same name
        const parentLogger = this.loggers.find(logger => name.startsWith(logger.name + '.'));
        if (parentLogger) {
            // inherit transports
            if (parentLogger.transports && Array.isArray(parentLogger.transports)) {
                parentLogger.transports.forEach(transport => logger.addTransport(transport));
            }
            // inherit level
            if (parentLogger.level) {
                logger.level = parentLogger.level;
            }
        }
    
        // add to list
        this.loggers.push(logger);
        return logger;
    }
}

export const logging = new LogBuilder()