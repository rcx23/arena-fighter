export enum TileType {
  Floor = 0,
  Wall = 1,
  Bush = 2,
  Water = 3,
}

export const TILE_SIZE = 1;

export const isWalkable = (t: TileType): boolean => t === TileType.Floor || t === TileType.Bush;
export const blocksProjectile = (t: TileType): boolean => t === TileType.Wall;
