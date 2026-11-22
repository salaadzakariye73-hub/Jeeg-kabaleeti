import { Hammer } from 'lucide-react';
import React, { useState } from 'react';
import type { EquipmentCategory } from '../../shared/types';

export const KABALEETI_IMAGE_PATH = '/src/assets/images/kabaleeti_props_1795328938737.jpg';
export const JEEG_IMAGE_PATH = '/src/assets/images/jeeg_frames_1795328938783.jpg';

interface EquipmentVisualProps {
  category: EquipmentCategory;
  photoUrl?: string;
  alt: string;
  className?: string;
}

export const EquipmentVisual: React.FC<EquipmentVisualProps> = ({
  category,
  photoUrl,
  alt,
  className = 'w-full h-36',
}) => {
  const [failed, setFailed] = useState(false);
  const src = photoUrl || (category === 'KABALEETI' ? KABALEETI_IMAGE_PATH : JEEG_IMAGE_PATH);

  if (failed || !src) {
    return (
      <div
        className={`${className} flex flex-col items-center justify-center rounded-lg border border-slate-200 ${
          category === 'KABALEETI'
            ? 'bg-gradient-to-br from-[#245B91]/10 to-[#172B42]/10 text-[#245B91]'
            : 'bg-gradient-to-br from-[#E58A24]/15 to-[#D64545]/10 text-[#E58A24]'
        }`}
      >
        <Hammer className="w-7 h-7 mb-1.5" />
        <span className="text-xs font-semibold text-[#202B38]">{category}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} object-cover rounded-lg border border-slate-200 bg-slate-100`}
    />
  );
};
