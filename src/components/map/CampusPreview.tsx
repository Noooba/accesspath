import type { SiteGraph, RouteResult } from "@/types";
import { mapPoint, geometryPoint } from "./projection";
export function CampusPreview({
  graph,
  result,
  secondary,
  compact = false,
}: {
  graph: SiteGraph;
  result: RouteResult;
  secondary?: RouteResult;
  compact?: boolean;
}) {
  const project = ([north, east]: [number, number]) => [
    60 + east * 1.9,
    395 - north * 1.9,
  ];
  const pathFor = (ids: string[]) =>
    ids
      .map((id) => graph.edges.find((e) => e.id === id))
      .filter((e) => !!e)
      .map((e) =>
        e.geometry.map((c) => project(geometryPoint(c)).join(",")).join(" "),
      );
  return (
    <svg
      className={`campus-preview ${compact ? "compact" : ""}`}
      viewBox="0 0 610 460"
      role="img"
      aria-label="Calculated routes in an invented demonstration campus; not a real-world survey"
    >
      <defs>
        <pattern
          id="preview-grid"
          width="30"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r=".7" fill="#dce3e4" />
        </pattern>
      </defs>
      <rect width="610" height="460" fill="#f0f4f2" />
      <rect width="610" height="460" fill="url(#preview-grid)" />
      <path d="M32 98Q84 45 169 57L237 74 217 176 65 178Z" fill="#e2ece3" />
      <path d="M365 225Q471 200 558 290L538 389 401 373Z" fill="#e2ece3" />
      <path d="M247 19h151v65H247z" fill="#e9efdf" />
      {graph.nodes
        .filter((n) => n.nodeType === "destination")
        .map((n) => {
          const [x, y] = project(mapPoint(n));
          return (
            <g key={n.id}>
              <rect
                x={x - 20}
                y={y - 32}
                width="44"
                height="29"
                rx="3"
                fill="#dce3e3"
                stroke="#cbd5d7"
              />
              <path
                d={`M${x - 12} ${y - 26}h27M${x - 12} ${y - 20}h27`}
                stroke="#f8faf9"
                strokeWidth="2"
              />
            </g>
          );
        })}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {graph.edges.map((e) => (
          <polyline
            key={e.id}
            points={e.geometry
              .map((c) => project(geometryPoint(c)).join(","))
              .join(" ")}
            stroke={e.operationalStatus === "blocked" ? "#b42332" : "#d0d9d9"}
            strokeWidth={e.operationalStatus === "blocked" ? 3 : 5}
            strokeDasharray={
              e.operationalStatus === "blocked" ? "4 5" : undefined
            }
          />
        ))}
        {secondary?.status === "found" &&
          pathFor(secondary.edgeIds).map((points, i) => (
            <polyline
              key={`second-${i}`}
              points={points}
              stroke="#416eaf"
              strokeWidth="4"
              strokeDasharray="6 6"
            />
          ))}
        {result.status === "found" &&
          pathFor(result.edgeIds).map((points, i) => (
            <polyline
              key={i}
              points={points}
              stroke="#087f78"
              strokeWidth="5"
            />
          ))}
      </g>
      {graph.nodes
        .filter(
          (n) =>
            n.nodeType === "destination" ||
            n.id === "main-gate" ||
            n.nodeType === "ramp",
        )
        .map((n) => {
          const [x, y] = project(mapPoint(n));
          const big =
            n.id === result.nodeIds[0] || n.id === result.nodeIds.at(-1);
          return (
            <g key={n.id}>
              <circle
                cx={x}
                cy={y}
                r={big ? 8 : 4}
                fill={big ? "#087f78" : "#fff"}
                stroke="#087f78"
                strokeWidth="2"
              />
              {!compact &&
                [
                  "main-gate",
                  "library",
                  "gym",
                  "arts",
                  "student-center",
                  "science",
                  "garden",
                ].includes(n.id) && (
                  <text
                    x={x}
                    y={y + 21}
                    textAnchor="middle"
                    fill="#526174"
                    fontFamily="Inter,sans-serif"
                    fontSize="9"
                    fontWeight="500"
                  >
                    {n.name}
                  </text>
                )}
            </g>
          );
        })}
      <g transform="translate(557 35)" fill="none" stroke="#728185">
        <path d="m0 20 7-20 7 20-7-5z" />
        <text
          x="7"
          y="-7"
          fill="#526174"
          stroke="none"
          textAnchor="middle"
          fontSize="10"
        >
          N
        </text>
      </g>
    </svg>
  );
}
