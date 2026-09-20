export class DifficultyEngine {

    constructor() {

        this.level = 1;

        this.name = "BEGINNER";

        this.attackFrequency = 1;

        this.attackSophistication = 1;

        this.falsePositiveRate = 0;

        this.simultaneousIncidents = 1;
    }


    update(elapsedSeconds) {

        const newLevel =
            Math.floor(elapsedSeconds / 120) + 1;

        if (newLevel === this.level) return;

        this.level = newLevel;

        this.recalculate();
    }


    recalculate() {

        this.attackFrequency =
            1 + ((this.level - 1) * 0.25);

        this.attackSophistication =
            1 + ((this.level - 1) * 0.20);

        this.falsePositiveRate =
            Math.min(
                0.35,
                (this.level - 1) * 0.04
            );

        this.simultaneousIncidents =
            Math.min(
                5,
                Math.ceil(this.level / 2)
            );


        if (this.level <= 2) {

            this.name = "BEGINNER";

        } else if (this.level <= 4) {

            this.name = "INTERMEDIATE";

        } else if (this.level <= 7) {

            this.name = "ADVANCED";

        } else if (this.level <= 10) {

            this.name = "EXPERT";

        } else {

            this.name = "CRITICAL";
        }
    }


    getState() {

        return {
            level: this.level,
            name: this.name,
            attackFrequency: this.attackFrequency,
            attackSophistication: this.attackSophistication,
            falsePositiveRate: this.falsePositiveRate,
            simultaneousIncidents: this.simultaneousIncidents
        };
    }
}