import type { RouteNode } from "@/types";
/** Display projection for invented local coordinates. Routing never uses display pixels. */
export function mapPoint(point: {
  latitude: number;
  longitude: number;
}): [number, number] {
  return [
    (point.latitude - 0.001) * 111195.0802,
    (point.longitude - 0.001) * 111195.0802,
  ];
}
export function geometryPoint(coordinate: [number, number]): [number, number] {
  return mapPoint({ latitude: coordinate[0], longitude: coordinate[1] });
}
export function labelAnchor(node: RouteNode) {
  return mapPoint(node);
}
