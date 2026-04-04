import { SvgIcon } from "@/components/SvgIcon";
import StarIcon from "@/icons/profile-star.svg"

const ActivityRows = ({
  src,
  text,
  value,
}: {
  src: string;
  text: string;
  value: string;
}) => {
  return (
    <div>
      <div className="grid grid-cols-[0.8fr_2.5fr_1fr] border-b border-[#525252]/30">
        <span></span>
        <div className="flex gap-2 py-3 text-left items-center text-[#E8EAE9] text-xs border-r border-[#525252]/30">
          <SvgIcon src={src} />
          <span>{text}</span>
        </div>
        <div className="flex gap-2 py-3 justify-center items-center text-xs">
          <img src={StarIcon} />
          <span className="text-[#E8EAE9]">{value}</span>
        </div>
      </div>
    </div>
  );
};

export default ActivityRows;
