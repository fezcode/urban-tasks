import React from 'react';

interface Props {
  projectId: string;
  color: string;
  size?: number;
}

// Simple hash from string to deterministic number
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Generate a deterministic abstract shape SVG based on project ID
const ProjectIcon: React.FC<Props> = ({ projectId, color, size = 28 }) => {
  const h = hash(projectId);
  const shapeType = h % 7;
  const rotation = (h % 6) * 30;

  const bg = color;
  // Lighter version for inner shapes
  const inner = `${color}66`;

  const renderShape = () => {
    switch (shapeType) {
      // Nested circles
      case 0:
        return (
          <>
            <circle cx="14" cy="14" r="10" fill={bg} />
            <circle cx="14" cy="14" r="5.5" fill={inner} />
            <circle cx="14" cy="10" r="2.5" fill="white" fillOpacity="0.5" />
          </>
        );

      // Stacked semicircles
      case 1:
        return (
          <>
            <circle cx="14" cy="14" r="11" fill={bg} />
            <path d="M6 14a8 8 0 0 1 16 0" fill="white" fillOpacity="0.2" />
            <path d="M9 14a5 5 0 0 0 10 0" fill="white" fillOpacity="0.15" />
          </>
        );

      // Diamond in circle
      case 2:
        return (
          <>
            <circle cx="14" cy="14" r="11" fill={bg} />
            <rect
              x="9"
              y="9"
              width="10"
              height="10"
              rx="1.5"
              transform={`rotate(45 14 14)`}
              fill="white"
              fillOpacity="0.25"
            />
          </>
        );

      // Overlapping circles
      case 3:
        return (
          <>
            <circle cx="14" cy="14" r="11" fill={bg} />
            <circle cx="11" cy="12" r="5" fill="white" fillOpacity="0.2" />
            <circle cx="17" cy="16" r="5" fill="white" fillOpacity="0.15" />
          </>
        );

      // Triangle in circle
      case 4:
        return (
          <>
            <circle cx="14" cy="14" r="11" fill={bg} />
            <polygon
              points="14,7 20,19 8,19"
              fill="white"
              fillOpacity="0.25"
              strokeLinejoin="round"
            />
          </>
        );

      // Bars / stripes
      case 5:
        return (
          <>
            <rect x="3" y="3" width="22" height="22" rx="7" fill={bg} />
            <rect x="7" y="8" width="14" height="2.5" rx="1.25" fill="white" fillOpacity="0.3" />
            <rect x="7" y="13" width="10" height="2.5" rx="1.25" fill="white" fillOpacity="0.2" />
            <rect x="7" y="18" width="7" height="2.5" rx="1.25" fill="white" fillOpacity="0.15" />
          </>
        );

      // Hexagon
      case 6:
      default:
        return (
          <>
            <circle cx="14" cy="14" r="11" fill={bg} />
            <polygon
              points="14,6 20.5,10 20.5,18 14,22 7.5,18 7.5,10"
              fill="white"
              fillOpacity="0.2"
            />
            <circle cx="14" cy="14" r="3" fill="white" fillOpacity="0.2" />
          </>
        );
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      className="flex-shrink-0"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {renderShape()}
    </svg>
  );
};

export default ProjectIcon;
