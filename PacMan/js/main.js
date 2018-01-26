
import {
    ACTORMODE,
    GAMEMODE,
    BLOCKSIZE,
    LEVELCONFIG,
    TIMES,
    PEN_LEAVING_FOOD_LIMITS,
} from "./Misc/GameRes"

import GameRes from "./Misc/GameRes"
import WorldMap from './Misc/WorldMap'
import Player from './Misc/Player'
import TileCollide from './Misc/TileCollide'
import Ghost from './Ghosts/Ghost'

let PlatformDifference = {
    "ios": {
        touchstart: "ontouchstart",
        touchmove: "ontouchmove",
        touchcancel: "ontouchcancel",
        touchend: "ontouchend"
    },
    "android": {
        touchstart: "ontouchstart",
        touchmove: "ontouchmove",
        touchcancel: "ontouchcancel",
        touchend: "ontouchend"
    },
    "devtools": {
        touchstart: "touchstart",
        touchmove: "touchmove",
        touchcancel: "touchcancel",
        touchend: "touchend"
    }
}

let canvas = wx.createCanvas()
let ctx = canvas.getContext('2d')
let gameRes = new GameRes(ctx, canvas.width, canvas.height);
let tileCollide = new TileCollide();

const DEFAULT_FPS = 60;
const halfBLOCKSIZE = (BLOCKSIZE >> 1);
/**
 * 游戏主函数
 */

export default class Main {
    constructor() {
        this.platform = "devtools";//"ios";//
        this.touchHandler = this.touchEventHandler.bind(this)
        wx.onTouchStart(this.touchHandler);
        wx.onTouchEnd(this.touchHandler);
        wx.onTouchCancel(this.touchHandler);
        this.gameplayMode = GAMEMODE.KILL_SCREEN;
        this.restart()
    }

    killScreen(is256) {

    }

    newGame() {
        this.frame = 0;
        this.playerCount = 1;
        this.timing = {};
        for (var b in TIMES) {
            var c = TIMES[b];
            this.timing[b] = Math.round(c * DEFAULT_FPS / 1.5)
        }
        this.createActors();
        this.startGameplay();
    }

    createActors() {
        this.worldMap = new WorldMap(this);
        this.mapAdj = this.worldMap.adjFun.bind(this.worldMap);
        this.playerCount = 1;
        this.player = new Player(this);
        this.actors = [];
        for (let i = 0; i < 4; ++i) {
            this.actors.push(new Ghost(i + this.playerCount, this));
        }
    }

    startGameplay() {
        this.score = [0, 0];
        this.extraLifeAwarded = [false, false];
        this.lives = 3;
        this.level = 0;
        this.paused = false;
        this.globalTime = 0;
        this.newLevel(true);
    }

    newLevel(newStart) {
        this.level++;
        this.levels = this.level >= LEVELCONFIG.length ? LEVELCONFIG[LEVELCONFIG.length - 1] : LEVELCONFIG[this.level];
        // start issue 14: Ghosts stay blue permanently on restart
        if ((this.levels.frightTime > 0) && (this.levels.frightTime <= 6))
            this.levels.frightTime = Math.round(this.levels.frightTime * DEFAULT_FPS);
        // end issue 14
        this.levels.frightTotalTime = this.levels.frightTime + this.timing[1] * (this.levels.frightBlinkCount * 2 - 1);
        // for (var k in this.actors)
        //     this.actors[k].dotCount = 0;
        this.player.dotCount = 0;
        this.alternatePenLeavingScheme = false;
        this.lostLifeOnThisLevel = false;
        this.resetPlayfield();
        this.restartGameplay(newStart);
        //g.level == 256 && g.killScreen()
    }

    resetPlayfield() {
        this.worldMap.dotsRemaining = 0;
        this.worldMap.dotsEaten = 0;
        // g.playfieldEl.innerHTML = "";
        // g.prepareElement(g.playfieldEl, 256, 0);
        this.worldMap.determinePlayfieldDimensions();//确定地图宽高
        this.worldMap.preparePlayfield();//
        this.worldMap.preparePaths();
        this.worldMap.prepareAllowedDirections();
        // g.createPlayfieldElements();
        // g.createActorElements()
    };
    restartGameplay(newStart) {
        this.seed(0);
        this.frightModeTime = 0;
        this.intervalTime = 0;
        this.gameplayModeTime = 0;
        this.fruitTime = 0;
        this.ghostModeSwitchPos = 0;
        this.ghostModeTime = this.levels.ghostModeSwitchTimes[0] * DEFAULT_FPS;
        this.ghostExitingPenNow = false;
        this.ghostEyesCount = 0;
        this.tilesChanged = false;

        this.updateCruiseElroySpeed();
        //this.hideFruit();
        this.resetForcePenLeaveTime();
        this.restartActors();
        //g.updateActorPositions();
        this.switchMainGhostMode(ACTORMODE.SCATTER, true);
        for (var c = 1; c < 4; c++)
            this.actors[c].changeActorMode(ACTORMODE.IN_PEN);
        //g.dotEatingChannel = [0, 0];
        //g.dotEatingSoundPart = [1, 1];
        //g.clearDotEatingNow();
        newStart ? this.changeGameplayMode(GAMEMODE.NEWGAME_STARTING) : this.changeGameplayMode(GAMEMODE.GAME_RESTARTING)
        //this.changeGameplayMode(GAMEMODE.CUTSCENE);

    }
    resetForcePenLeaveTime() {
        this.forcePenLeaveTime = this.levels.penForceTime * DEFAULT_FPS
    };
    restartActors() {
        for (let key in this.actors) {
            this.actors[key].resetActor();
        }
        this.player.resetPlayer();
    }
    //游戏结束后的触摸事件处理逻辑
    touchEventHandler(e) {
        // e.preventDefault()
        if (e.type == PlatformDifference[this.platform].touchstart) {
            this.touchStartX = e.touches[0].clientX
            this.touchStartY = e.touches[0].clientY
        } else if (e.type == PlatformDifference[this.platform].touchend) {
            if (this.gameplayMode == GAMEMODE.KILL_SCREEN) {

                this.newGame();
                return;
            }
            let deltaX = e.changedTouches[0].clientX - this.touchStartX;
            let deltaY = e.changedTouches[0].clientY - this.touchStartY;
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > 0.5)//右
                    this.player.requestDir = 8;
                else if (deltaX < -0.5)//左
                    this.player.requestDir = 4;
            }
            else {
                if (deltaY > 0.5)//下
                    this.player.requestDir = 2;
                else if (deltaY < -0.5)//上
                    this.player.requestDir = 1;
            }

        }
    }

    restart() {



        requestAnimationFrame(
            this.loop.bind(this),
            canvas
        )
    }



    handleGhostModeTimer = function () {
        if (this.frightModeTime) {
            this.frightModeTime--;
            if (this.frightModeTime <= 0) {
                this.frightModeTime = 0;
                this.finishFrightMode()
            }
        } else if (this.ghostModeTime > 0) {
            this.ghostModeTime--;
            if (this.ghostModeTime <= 0) {
                this.ghostModeTime = 0;
                this.ghostModeSwitchPos++;
                if (this.levels.ghostModeSwitchTimes[this.ghostModeSwitchPos]) {
                    this.ghostModeTime = this.levels.ghostModeSwitchTimes[this.ghostModeSwitchPos] * DEFAULT_FPS;
                    switch (this.mainGhostMode) {
                        case ACTORMODE.SCATTER:
                            this.switchMainGhostMode(ACTORMODE.CHASE, false);
                            break;
                        case ACTORMODE.CHASE:
                            this.switchMainGhostMode(ACTORMODE.SCATTER, false);
                            break
                    }
                }
            }
        }
    };


    handleForcePenLeaveTimer() {
        if (this.forcePenLeaveTime) {
            this.forcePenLeaveTime--;
            if (this.forcePenLeaveTime <= 0) {
                for (var b = 1; b <= 3; b++) {
                    if (this.actors[b].mode == ACTORMODE.IN_PEN) {
                        this.actors[b].freeToLeavePen = true;
                        break;
                    }
                }
                this.resetForcePenLeaveTime()
            }
        }
    }
    handleTimers() {
        if (this.gameplayMode == GAMEMODE.ORDINARY_PLAYING) {
            this.handleForcePenLeaveTimer();
            //this.handleFruitTimer();
            this.handleGhostModeTimer()
        }
        this.handleGameplayModeTimer()
    };
    // 游戏逻辑更新主函数
    update() {
        if (this.gameplayMode == GAMEMODE.KILL_SCREEN)
            return;

        if (this.gameplayMode == GAMEMODE.CUTSCENE) {
        } else {
            if (this.gameplayMode == GAMEMODE.ORDINARY_PLAYING) {
                for (let k in this.actors) {
                    this.actors[k].update();
                }

                let playerSpeed = this.player.speed
                if (Math.round(this.player.pos[1]) == 14 * BLOCKSIZE + halfBLOCKSIZE &&
                    this.player.pos[0] < BLOCKSIZE + halfBLOCKSIZE || this.player.pos[0] > 26 * BLOCKSIZE + halfBLOCKSIZE)
                    playerSpeed = this.player.tunnelSpeed;

                let halfBLOCKSIZE = (BLOCKSIZE >> 1);
                this.player.pos = tileCollide.Move2(this.player, playerSpeed * 1.5, this.mapAdj);
                let mapWidth = (this.worldMap.playfieldWidth + 1) * BLOCKSIZE;
                if (this.player.pos[0] < -halfBLOCKSIZE && this.player.dir == 4)
                    this.player.pos[0] += mapWidth + halfBLOCKSIZE;
                else if (this.player.pos[0] > mapWidth + halfBLOCKSIZE && this.player.dir == 8)
                    this.player.pos[0] -= (mapWidth + halfBLOCKSIZE);
                this.player.update();

                if (this.gameplayMode == GAMEMODE.ORDINARY_PLAYING) {
                    if (this.tilesChanged) {
                        this.tilesChanged = false;
                        this.detectCollisions();
                        this.updateActorTargetPositions()
                    }
                }
            }
            this.handleTimers();
        }
    }


    detectCollisions() {
        for (var i = 0; i < 4; i++) {
            if (this.actors[i].tilePos[0] == this.player.tilePos[0] &&
                this.actors[i].tilePos[1] == this.player.tilePos[1]) {
                // If the ghost is blue, Pac-Man eats the ghost...
                if (this.actors[i].mode == ACTORMODE.FRIGHTENED) {
                    this.ghostDies(i, 0);
                    // return here prevents from two ghosts being eaten at the same time
                    return
                } else {
                    // ...otherwise, the ghost kills Pac-Man
                    // if (this.actors[i].mode != ACTORMODE.EATEN &&
                    //     this.actors[i].mode != ACTORMODE.IN_PEN &&
                    //     this.actors[i].mode != ACTORMODE.LEAVING_PEN &&
                    //     this.actors[i].mode != ACTORMODE.RE_LEAVING_FROM_PEN &&
                    //     this.actors[i].mode != ACTORMODE.ENTERING_PEN)
                    //     this.playerDies(j)
                }
            }
        }
    };

    ghostDies(b, c) {
        //this.playSound("eating-ghost", 0);
        this.addToScore(200 * this.modeScoreMultiplier, c);
        this.modeScoreMultiplier *= 2;
        this.ghostBeingEatenId = b;
        this.playerEatingGhostId = c;
        this.changeGameplayMode(GAMEMODE.GHOST_DIED)
    };



    finishFrightMode() {
        this.switchMainGhostMode(this.lastMainGhostMode, false)
    };
    dotEaten(b, c) {
        this.worldMap.dotsRemaining--;
        this.worldMap.dotsEaten++;

        //this.playDotEatingSound(b);
        if (this.worldMap.playfield[c[1]][c[0]].dot == 2) {
            this.switchMainGhostMode(ACTORMODE.FRIGHTENED, false);
            this.addToScore(50, b)
        } else this.addToScore(10, b);
        this.worldMap.playfield[c[1]][c[0]].dot = 0;
        this.updateCruiseElroySpeed();
        this.resetForcePenLeaveTime();
        this.figureOutPenLeaving();
        // if (this.dotsEaten == 70 || this.dotsEaten == 170)
        //     this.showFruit();
        // this.dotsRemaining == 0 && this.finishLevel();
        // this.playAmbientSound()
    };
    addToScore(b, c) {
        this.score[c] += b;
        !this.extraLifeAwarded[c] && this.score[c] > 1E4 && this.extraLife(c);
        //g.updateChromeScore(c)
    };
    extraLife = function (b) {
        //this.playSound("extra-life", 0);
        this.extraLifeAwarded[b] = true;
        this.lives++;
        if (this.lives > 5)
            this.lives = 5;
    };
    figureOutPenLeaving() {
        if (this.alternatePenLeavingScheme) {
            this.alternateDotCount++;
            switch (this.alternateDotCount) {
                case PEN_LEAVING_FOOD_LIMITS[1]:
                    this.actors[1].freeToLeavePen = true;
                    break;
                case PEN_LEAVING_FOOD_LIMITS[2]:
                    this.actors[2].freeToLeavePen = true;
                    break;
                case PEN_LEAVING_FOOD_LIMITS[3]:
                    if (this.actors[3].mode == ACTORMODE.IN_PEN)
                        this.alternatePenLeavingScheme = false;
                    break
            }
        } else if (this.actors[1].mode == 16 || this.actors[1].mode == 8) {
            this.actors[1].dotCount++;
            if (this.actors[1].dotCount >= this.levels.penLeavingLimits[1])
                this.actors[1].freeToLeavePen = true
        } else if (this.actors[2].mode == 16 || this.actors[2].mode == 8) {
            this.actors[2].dotCount++;
            if (this.actors[2].dotCount >= this.levels.penLeavingLimits[2])
                this.actors[2].freeToLeavePen = true
        } else if (this.actors[3].mode == 16 || this.actors[3].mode == 8) {
            this.actors[3].dotCount++;
            if (this.actors[3].dotCount >= this.levels.penLeavingLimits[3])
                this.actors[3].freeToLeavePen = true
        }
    };

    render() {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (this.gameplayMode == GAMEMODE.KILL_SCREEN)
            return;
        //ctx.clearRect(0, 0, canvas.width, canvas.height)

        if (this.gameplayMode == GAMEMODE.NEWGAME_STARTING) {
            this.worldMap.render(gameRes);
            this.player.render(gameRes);
        }
        else if (this.gameplayMode == GAMEMODE.NEWGAME_STARTED || this.gameplayMode == GAMEMODE.ORDINARY_PLAYING) {
            this.worldMap.render(gameRes);
            this.player.render(gameRes);
            for (let k in this.actors) {
                this.actors[k].render(gameRes);
            }
        }
    }

    // 实现游戏帧循环
    loop() {
        this.frame++;

        this.update()
        this.render()


        // // 游戏结束停止帧循环
        // if (databus.gameOver) {
        //     this.gameinfo.renderGameOver(ctx, databus.score)
        //     return
        // }

        requestAnimationFrame(
            this.loop.bind(this),
            canvas
        )
    }


    switchMainGhostMode(actorMode, c) {
        if (actorMode == ACTORMODE.FRIGHTENED && this.levels.frightTime == 0)//惊吓状态结束,掉头
            for (var k in this.actors) {
                var actor = this.actors[k];
                actor.reverseDirectionsNext = true
            }
        else {
            let oldMode = this.mainGhostMode;
            if (actorMode == ACTORMODE.FRIGHTENED && this.mainGhostMode != ACTORMODE.FRIGHTENED)
                this.lastMainGhostMode = this.mainGhostMode;
            this.mainGhostMode = actorMode;
            // if (actorMode == ACTORMODE.FRIGHTENED || oldMode == ACTORMODE.FRIGHTENED)
            //     this.playAmbientSound();
            switch (actorMode) {
                case ACTORMODE.CHASE://1
                case ACTORMODE.SCATTER://2
                    this.currentPlayerSpeed = this.levels.playerSpeed * 0.8;
                    this.currentDotEatingSpeed = this.levels.dotEatingSpeed * 0.8;
                    break;
                case ACTORMODE.FRIGHTENED://4
                    this.currentPlayerSpeed = this.levels.playerFrightSpeed * 0.8;
                    this.currentDotEatingSpeed = this.levels.dotEatingFrightSpeed * 0.8;
                    this.frightModeTime = this.levels.frightTotalTime;
                    this.modeScoreMultiplier = 1;
                    break
            }
            for (let k in this.actors) {
                actor = this.actors[k];
                if (actorMode != ACTORMODE.ENTERING_PEN && !c)
                    actor.modeChangedWhileInPen = true;
                if (actorMode == ACTORMODE.FRIGHTENED)
                    actor.eatenInThisFrightMode = false;
                if (actor.mode != ACTORMODE.EATEN &&
                    actor.mode != ACTORMODE.IN_PEN &&
                    actor.mode != ACTORMODE.LEAVING_PEN &&
                    actor.mode != ACTORMODE.RE_LEAVING_FROM_PEN &&
                    actor.mode != ACTORMODE.ENTERING_PEN || c) {
                    if (!c && actor.mode != ACTORMODE.FRIGHTENED && actor.mode != actorMode)
                        actor.reverseDirectionsNext = true;
                    actor.changeActorMode(actorMode)
                }
            }
            this.player.fullSpeed = this.currentPlayerSpeed;
            this.player.dotEatingSpeed = this.currentDotEatingSpeed;
            this.player.tunnelSpeed = this.currentPlayerSpeed;
        }
    }


    rand() {
        var t32 = 0x100000000;
        var constant = 134775813;
        var x = (constant * this.randSeed + 1);
        return (this.randSeed = x % t32) / t32;
    };
    seed(b) {
        this.randSeed = b
    };

    getDistance(b, c) {
        return Math.sqrt((c[1] - b[1]) * (c[1] - b[1]) + (c[0] - b[0]) * (c[0] - b[0]))
    };

    updateActorTargetPositions() {
        for (var b in this.actors)
            this.actors[b].updateTargetPos()
    };


    changeGameplayMode(_mode) {
        this.gameplayMode = _mode;
        //if (_mode != 13) {
        //    for (var c = 0; c < g.playerCount + 4; c++)
        //        g.actors[c].b();
        //}
        switch (_mode) {
            case GAMEMODE.ORDINARY_PLAYING://0 游戏开始
                //this.playAmbientSound();
                break;
            case GAMEMODE.PLAYER_DYING://2:
                //this.stopAllAudio();
                this.gameplayModeTime = this.timing[3];
                break;
            case GAMEMODE.PLAYER_DIED://3:
                //this.playerDyingId == 0 ? this.playSound("death", 0) : this.playSound("death-double", 0);
                this.gameplayModeTime = this.timing[4];
                break;
            case GAMEMODE.GAME_RESTARTING://6:
                //g.canvasEl.style.visibility = "hidden";
                this.gameplayModeTime = this.timing[5];
                break;
            case GAMEMODE.GAME_RESTARTED://7
                //    this.stopAllAudio();
                //    g.canvasEl.style.visibility = "";
                //    g.doorEl.style.display = "block";
                //    b = document.createElement("div");
                //    b.id = "pcm-re";
                //    g.prepareElement(b, 160, 0);
                //    g.playfieldEl.appendChild(b);
                this.showReady = true;
                this.gameplayModeTime = this.timing[6];
                break;
            case GAMEMODE.NEWGAME_STARTING://4://显示READY!倒计时等待游戏开始
                //g.doorEl.style.display = "block";
                // b = document.createElement("div");
                // b.id = "pcm-re";
                //g.prepareElement(b, 160, 0);
                // g.playfieldEl.appendChild(b);//READY!的字样
                this.showReady = true;
                this.gameplayModeTime = this.timing[7];
                //this.stopAllAudio();
                //this.playSound("start-music", 0, true);
                break;
            case GAMEMODE.NEWGAME_STARTED://5://减少生命,再倒计时
                this.lives--;
                //g.updateChromeLives();
                this.gameplayModeTime = this.timing[8];
                break;
            case GAMEMODE.GAMEOVER://8
            case GAMEMODE.KILL_SCREEN://14
                // b = document.getElementById("pcm-re");
                // google.dom.remove(b);
                this.stopAllAudio();
                // b = document.createElement("div");
                // b.id = "pcm-go";
                // g.prepareElement(b, 8, 152);
                // g.playfieldEl.appendChild(b);
                this.gameplayModeTime = this.timing[9];
                break;
            case GAMEMODE.LEVEL_BEING_COMPLETED://9
                this.stopAllAudio();
                this.gameplayModeTime = this.timing[10];
                break;
            case GAMEMODE.LEVEL_COMPLETED://10
                // g.doorEl.style.display = "none";
                this.gameplayModeTime = this.timing[11];
                break;
            case GAMEMODE.TRANSITION_INTO_NEXT_SCENE://11
                // g.canvasEl.style.visibility = "hidden";
                this.gameplayModeTime = this.timing[12];
                break;
            case 12:
                // g.playfieldEl.style.visibility = "hidden";
                this.gameplayModeTime = this.timing[13];
                break;
            case GAMEMODE.GHOST_DIED://1
                this.gameplayModeTime = this.timing[2];
                break;
            case GAMEMODE.CUTSCENE://13
                this.startCutscene();
                break
        }
    }

    handleGameplayModeTimer() {
        if (this.gameplayModeTime) {
            this.gameplayModeTime--;
            // switch (this.gameplayMode) {
            //     case 2:
            //     case 3:
            //         for (var b = 0; b < this.playerCount + 4; b++) 
            //             this.actors[b].b();
            //         break;
            //     case 10:
            //         Math.floor(this.gameplayModeTime / (this.timing[11] / 8)) % 2 == 0 ? g.changeElementBkPos(g.playfieldEl, 322, 2, e) : g.changeElementBkPos(g.playfieldEl, 322, 138, e)
            // }
            if (this.gameplayModeTime <= 0) {
                this.gameplayModeTime = 0;
                switch (this.gameplayMode) {
                    case GAMEMODE.GHOST_DIED:
                        this.changeGameplayMode(GAMEMODE.ORDINARY_PLAYING);
                        this.ghostEyesCount++;
                        //this.playAmbientSound();
                        this.actors[this.ghostBeingEatenId].changeActorMode(ACTORMODE.EATEN);
                        var c = false;
                        for (let b = this.playerCount; b < this.playerCount + 4; b++)
                            if (this.actors[b].mode == ACTORMODE.FRIGHTENED ||
                                (this.actors[b].mode == ACTORMODE.IN_PEN || this.actors[b].mode == ACTORMODE.RE_LEAVING_FROM_PEN) &&
                                !this.actors[b].eatenInThisFrightMode) {
                                c = true;
                                break
                            }
                        if (c == false) this.finishFrightMode();
                        break;
                    case GAMEMODE.PLAYER_DYING:
                        this.changeGameplayMode(GAMEMODE.PLAYER_DIED);
                        break;
                    case GAMEMODE.PLAYER_DIED:
                        this.newLife();
                        break;
                    case GAMEMODE.NEWGAME_STARTING://4:
                        this.changeGameplayMode(GAMEMODE.NEWGAME_STARTED);
                        break;
                    case GAMEMODE.GAME_RESTARTING:
                        this.changeGameplayMode(GAMEMODE.GAME_RESTARTED);
                        break;
                    case GAMEMODE.GAME_RESTARTED:
                    case GAMEMODE.NEWGAME_STARTED://5
                        this.showReady = false;
                        this.changeGameplayMode(GAMEMODE.ORDINARY_PLAYING);
                        break;
                    case GAMEMODE.GAMEOVER://GAME OVER
                        // b = document.getElementById("pcm-go");
                        // google.dom.remove(b);
                        // google.pacManQuery && google.pacManQuery();
                        break;
                    case GAMEMODE.LEVEL_BEING_COMPLETED:
                        this.changeGameplayMode(GAMEMODE.LEVEL_COMPLETED);
                        break;
                    case GAMEMODE.LEVEL_COMPLETED:
                        this.changeGameplayMode(GAMEMODE.TRANSITION_INTO_NEXT_SCENE);
                        break;
                    case GAMEMODE.TRANSITION_INTO_NEXT_SCENE:
                        if (this.levels.cutsceneId) {
                            this.cutsceneId = this.levels.cutsceneId;
                            this.changeGameplayMode(GAMEMODE.CUTSCENE)
                        } else {
                            // this.canvasEl.style.visibility = "";
                            this.newLevel(false)
                        }
                        break;
                    case 12:
                        // this.playfieldEl.style.visibility = "";
                        // this.canvasEl.style.visibility = "";
                        this.switchToDoubleMode();
                        break
                }
            }
        }
    }

    updateCruiseElroySpeed() {
        var b = this.levels.ghostSpeed * 0.8;
        if (!this.lostLifeOnThisLevel || this.actors[3].mode != ACTORMODE.IN_PEN) {
            var c = this.levels;
            if (this.worldMap.dotsRemaining < c.elroyDotsLeftPart2)
                b = c.elroySpeedPart2 * 0.8;
            else if (this.worldMap.dotsRemaining < c.elroyDotsLeftPart1)
                b = c.elroySpeedPart1 * 0.8
        }
        if (b != this.cruiseElroySpeed) {
            this.cruiseElroySpeed = b;
            this.actors[0].updateSpeed()
        }
    };
}