import Planet from "./Planet"
import Spaceship from "./Spaceship"
import Random from "./Random"
import Utils from "./Utils"
import { DATA } from "./Data/Maps"
import QuadTree from "./QuadTree"


let rand = new Random();

export default class World {
    constructor(screenWidth, screenHeight) {
        //this.CreatePlanets(players);
        this.CreateShips();
        this.fingerPos = [0, 0];
        this.waitShips = [];
        this.flyShips = [];



        this.quadTree = new QuadTree([0, 0, screenWidth << Utils.MULTI, screenHeight << Utils.MULTI]);

    }

    CreatePlanets(mapId, players) {
        this.planets = [];
        let mapData = DATA.MAPS[mapId];
        for (let i in mapData.Planets) {
            let p = mapData.Planets[i];
            let pl = new Planet([p.center[0] << Utils.MULTI, p.center[1] << Utils.MULTI], p.radius << Utils.MULTI, i, p.start)
            pl.maxHuman = p.max;
            pl.grow = p.grow;
            this.planets.push(pl)
            this.quadTree.insert(pl);
            pl.owner = 1;
        }
        for (let i in players) {
            let p = players[i];
            let pp = this.planets[mapData.Players[i]]
            pp.owner = p.id;
            pp.color = p.color;
        }
    }

    CreateShips() {
        this.ships = [];
        for (let i = 0; i < 300; i++) {
            let ship = new Spaceship([0, 0]);
            this.ships.push(ship);
            ship.target = [0, 0];
        }
    }

    Update(frame, updateCmd) {

        if (updateCmd.length > 1) {
            //for (let i in updateCmd) {
            for (let i = 1; i < updateCmd.length; i++) {
                let cmd = updateCmd[i];
                //let userId = cmd[0];
                //let startIdx = cmd[1];

                let endIdx = cmd[cmd.length - 1];
                for (let j = 0; j < cmd.length - 1; j++) {
                    let startPlanet = this.planets[cmd[j]];
                    let humans = startPlanet.Launch()
                    while (humans > 0) {
                        if (humans >= Utils.SHIPHUMANS) {
                            this.ShipLaunch(cmd[j], endIdx, Utils.SHIPHUMANS);
                            humans -= Utils.SHIPHUMANS;
                        } else {
                            this.ShipLaunch(cmd[j], endIdx, humans);
                            humans = 0;
                        }
                    }
                }
            }
        }

        // if (updateCmd.length == 3) {
        //     let cmd = updateCmd;
        //     let userId = cmd[0];
        //     let startIdx = cmd[1];
        //     let endIdx = cmd[2];
        //     let startPlanet = this.planets[startIdx];
        //     if (userId == startPlanet.owner) {
        //         let humans = startPlanet.Launch()
        //         while (humans > 0) {
        //             if (humans >= Utils.SHIPHUMANS) {
        //                 this.ShipLaunch(startIdx, endIdx, Utils.SHIPHUMANS);
        //                 humans -= Utils.SHIPHUMANS;
        //             } else {
        //                 this.ShipLaunch(startIdx, endIdx, humans);
        //                 humans = 0;
        //             }
        //         }
        //     }
        // }



        for (let i in this.planets) {
            let planet = this.planets[i];
            planet.Update(frame);
        }


        for (let i = 0; i < frame; ++i) {
            if (this.waitShips.length > 0) {
                this.flyShips.push(this.waitShips.shift());
            } else
                break;
        }

        for (let i = this.flyShips.length - 1; i >= 0; i--) {
            let ship = this.flyShips[i];
            ship.ResetDir();
            let mayTouchPlanets = this.quadTree.retrieve(ship);
            //console.log(mayTouchPlanets.length);
            ship.Dir = Utils.Normalize(ship.Dir);
            for (let j in mayTouchPlanets) {
                let pl = mayTouchPlanets[j];
                if (ship.startIdx != pl.id && ship.endIdx != pl.id) {
                    ship.Dir = pl.FilterDir(ship.pos, ship.Dir);
                }
            }

            if (ship.Update(frame) == false) {
                this.planets[ship.endIdx].Invade(ship, ship.humans);
                this.ships.push(ship);
                this.flyShips.splice(i, 1);
            }
        }


    }

    Draw(gameRes) {
        //gameRes.RenderText("world", 100, 100, 100);
        for (let i in this.planets) {
            this.planets[i].Draw(gameRes);
        }



        for (let i = this.flyShips.length - 1; i >= 0; i--) {
            let ship = this.flyShips[i];
            ship.Draw(gameRes);
        }

        this.quadTree.Render(gameRes);
    }





    ShipLaunch(startIdx, endIdx, humans) {
        let ship = this.ships.pop();
        if (ship == null)
            return;
        let planet = this.planets[startIdx];
        ship.pos[0] = planet.center[0] + rand.Range(-planet.radius >> 1, planet.radius >> 1);
        ship.pos[1] = planet.center[1] + rand.Range(-planet.radius >> 1, planet.radius >> 1);
        ship.rect[0] = ship.pos[0] - ship.size;
        ship.rect[1] = ship.pos[1] - ship.size;

        ship.active = true;
        ship.ResetInfo(planet, humans);

        planet = this.planets[endIdx];
        ship.target[0] = planet.center[0] + rand.Range(-planet.radius >> 1, planet.radius >> 1);
        ship.target[1] = planet.center[1] + rand.Range(-planet.radius >> 1, planet.radius >> 1);
        ship.startIdx = startIdx;
        ship.endIdx = endIdx;

        this.waitShips.push(ship);
    }


    ConvertToPlanetPos(owner = -1, pos) {
        for (let i = 0; i < this.planets.length; ++i) {
            let planet = this.planets[i];
            let deltaX = (pos[0]) - planet.center[0];
            let deltaY = (pos[1]) - planet.center[1];
            // if (owner >= 0 && owner != planet.owner)
            //     continue;
            if (deltaX * deltaX + deltaY * deltaY <= planet.radius * planet.radius) {
                return parseInt(planet.id) + (owner == planet.owner ? 0 : 100);
            }
        }
        return -1;
    }


}