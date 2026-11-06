/**
 * Medusa's module loader discovers MikroORM entities from the `models/`
 * directory. The canonical DML entity lives in `entities/`; re-export it
 * here so the module's own manager registers its metadata.
 */
export { Artist } from "../entities/artist";
