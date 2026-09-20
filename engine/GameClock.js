export class GameClock {

    constructor() {

        this.elapsedSeconds = 0;
        this.speed = 1;
        this.running = false;
        this.interval = null;
        this.listeners = [];
    }


    start() {

        if (this.running) return;

        this.running = true;

        this.interval = setInterval(
            () => this.tick(),
            1000 / this.speed
        );
    }


    stop() {

        this.running = false;

        if (this.interval) {

            clearInterval(this.interval);

            this.interval = null;
        }
    }


    tick() {

        if (!this.running) return;

        this.elapsedSeconds++;

        this.listeners.forEach(
            listener => listener(this.elapsedSeconds)
        );
    }


    setSpeed(speed) {

        this.speed =
            Math.max(
                0.25,
                Number(speed) || 1
            );

        if (this.running) {

            this.stop();
            this.start();
        }
    }


    onTick(listener) {

        if (typeof listener !== "function") {
            return;
        }

        this.listeners.push(listener);

        return () => {

            this.listeners =
                this.listeners.filter(
                    item => item !== listener
                );
        };
    }


    getFormattedTime() {

        const minutes =
            Math.floor(
                this.elapsedSeconds / 60
            );

        const seconds =
            this.elapsedSeconds % 60;

        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
}