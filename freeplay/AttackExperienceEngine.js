/* =========================================================
   NORTHSTAR SOC — EXPERIENCE OTHER ATTACKS
   Attack Experience Engine (v3 — animation sequencer)
   ---------------------------------------------------------
   Reusable, framework-only sequencer that plays a single
   attack's scripted TIMELINE — an ordered list of small
   actions (see the schema comment at the top of
   attackExperienceData.js) — one after another, waiting the
   action's own `wait` between each. Knows nothing about the
   DOM: AttackExperienceRenderer.js subscribes to `onAction`
   and does all the actual drawing/animating.

   This is what guarantees the attacker POV and the victim/SOC
   POV never run as independent animations: every action in
   the ONE shared timeline is emitted through this single
   sequencer, in order, regardless of which panel it targets —
   there is no separate "attacker clock" and "victim clock."

   Controls: play() / pause() / restart() / destroy() /
   getState(). There is no discrete "next step" any more — the
   whole point of this rebuild is that it plays as one
   continuous animation rather than jumping between static
   snapshots. pause()/play() can interrupt and resume mid-wait
   without losing the remaining time.
   ========================================================= */

(function () {

    "use strict";

    function createEngine(scenario, handlers) {

        handlers = handlers || {};

        const timeline = (scenario && scenario.timeline) || [];

        let running = false;
        let paused = false;
        let completed = false;
        let destroyed = false;
        let runId = 0;
        let speed = 1;

        let pauseWaiters = [];
        let pauseInterruptors = [];


        function emit(name, ...args) {

            if (destroyed) {
                return;
            }

            const handler = handlers[name];

            if (typeof handler === "function") {
                handler(...args);
            }

        }


        /* Sleeps `ms` (at the current playback speed), but if
           pause() is called mid-wait, blocks (consuming no time)
           until play() resumes it, then finishes out only the
           time that was left. `remaining` is tracked in UNSCALED
           ms so a speed change mid-wait takes effect on the very
           next chunk rather than only on the next action. */
        async function sleep(ms) {

            let remaining = ms;

            while (remaining > 0) {

                if (destroyed) {
                    return;
                }

                if (paused) {

                    await new Promise(resolve => {
                        pauseWaiters.push(resolve);
                    });

                    continue;

                }

                const currentSpeed = speed > 0 ? speed : 1;
                const chunkStart = Date.now();
                let interrupted = false;

                await new Promise(resolve => {

                    const timerId = setTimeout(resolve, remaining / currentSpeed);

                    pauseInterruptors.push(() => {
                        clearTimeout(timerId);
                        interrupted = true;
                        resolve();
                    });

                });

                remaining -= (Date.now() - chunkStart) * currentSpeed;

                if (interrupted) {
                    continue;
                }

            }

        }


        function wakeAll() {

            const waiters = pauseWaiters;
            pauseWaiters = [];
            waiters.forEach(fn => fn());

            const interruptors = pauseInterruptors;
            pauseInterruptors = [];
            interruptors.forEach(fn => fn());

        }


        async function runFrom(startIndex, myRunId) {

            for (let i = startIndex; i < timeline.length; i++) {

                if (destroyed || myRunId !== runId) {
                    return;
                }

                const action = timeline[i];

                emit("onAction", action, i, timeline.length);

                const gap = action.wait || 0;

                if (gap > 0) {

                    await sleep(gap);

                    if (destroyed || myRunId !== runId) {
                        return;
                    }

                }

            }

            if (destroyed || myRunId !== runId) {
                return;
            }

            running = false;
            completed = true;

            emit("onPlayStateChange", false);
            emit("onComplete", scenario);

        }


        return {

            play() {

                if (destroyed) {
                    return;
                }

                if (completed) {
                    this.restart();
                    return;
                }

                if (!running) {

                    running = true;
                    paused = false;
                    runId += 1;

                    emit("onPlayStateChange", true);

                    runFrom(0, runId);

                    return;

                }

                if (paused) {

                    paused = false;

                    emit("onPlayStateChange", true);

                    const waiters = pauseWaiters;
                    pauseWaiters = [];
                    waiters.forEach(fn => fn());

                }

            },


            pause() {

                if (destroyed || !running || paused || completed) {
                    return;
                }

                paused = true;

                emit("onPlayStateChange", false);

                const interruptors = pauseInterruptors;
                pauseInterruptors = [];
                interruptors.forEach(fn => fn());

            },


            restart() {

                if (destroyed) {
                    return;
                }

                runId += 1;
                wakeAll();

                running = false;
                paused = false;
                completed = false;

                emit("onReset");

                running = true;

                emit("onPlayStateChange", true);

                runFrom(0, runId);

            },


            destroy() {

                destroyed = true;
                runId += 1;
                wakeAll();

            },


            /* Changes playback speed immediately — takes effect on
               the very next sleep() chunk, even mid-wait, without
               needing to interrupt any in-flight timer. Any
               non-positive/invalid multiplier is ignored in favor
               of the default 1x. */
            setSpeed(multiplier) {

                speed = (typeof multiplier === "number" && multiplier > 0)
                    ? multiplier
                    : 1;

            },


            getState() {

                return { running, paused, completed, speed };

            }

        };

    }


    window.AttackExperienceEngine = {
        create: createEngine
    };

})();
