"use client";
import { ArrowUpRight, Check, Droplets, Sun, Wind } from "lucide-react";
import type { Language } from "@/lib/awareness";

export function AwarenessScene({
  language,
  onExplore,
  completed = [],
}: {
  language: Language;
  onExplore: (step: number) => void;
  completed?: string[];
}) {
  const hi = language === "hi";
  const points = [
    {
      id: "water",
      label: hi ? "पानी का बर्तन" : "Water container",
      Icon: Droplets,
      position: "left-[20%] top-[73%]",
    },
    {
      id: "window",
      label: hi ? "खुली खिड़की" : "Open window",
      Icon: Wind,
      position: "left-[61%] top-[58%]",
    },
    {
      id: "myth",
      label: hi ? "दिन का बचाव" : "Daytime protection",
      Icon: Sun,
      position: "right-[13%] top-[12%]",
    },
  ];
  return (
    <div className="relative isolate min-h-72 overflow-hidden rounded-3xl border border-white/10 bg-[#173a30] sm:min-h-96">
      <svg
        viewBox="0 0 640 430"
        className="h-full min-h-72 w-full"
        role="img"
        aria-label={
          hi
            ? "काल्पनिक आँगन: पानी का बर्तन, खुली खिड़की और दिन का सूरज। नीचे इन्हीं बिंदुओं की सूची भी है।"
            : "Fictional courtyard with a water container, an open window and daytime sun. The same points are listed below."
        }
      >
        <defs>
          <linearGradient id="awareness-sky" x2="0" y2="1">
            <stop stopColor="#235144" />
            <stop offset="1" stopColor="#183c31" />
          </linearGradient>
          <pattern
            id="awareness-grid"
            width="34"
            height="34"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M34 0H0V34"
              fill="none"
              stroke="#fff"
              strokeOpacity=".04"
            />
          </pattern>
        </defs>
        <path fill="url(#awareness-sky)" d="M0 0h640v430H0z" />
        <path fill="url(#awareness-grid)" d="M0 0h640v430H0z" />
        <circle cx="535" cy="73" r="32" fill="#efc987" opacity=".9" />
        <circle
          cx="535"
          cy="73"
          r="48"
          fill="none"
          stroke="#efc987"
          opacity=".13"
        />
        <path d="M0 328Q150 267 304 316T640 293V430H0Z" fill="#2f5945" />
        <ellipse
          cx="326"
          cy="369"
          rx="224"
          ry="26"
          fill="#0a241d"
          opacity=".35"
        />
        <path d="M189 200l147-65 169 62v147l-169 54-147-63Z" fill="#d3cbb0" />
        <path d="M336 216l169-19v147l-169 54Z" fill="#b3baa0" />
        <path d="M166 201l169-106 191 98-189 49Z" fill="#b36d50" />
        <path d="M166 201l171 41 189-49-10 20-179 48-170-43Z" fill="#6e493a" />
        <path
          d="M195 195l141-87 166 82M218 201l118-72 141 68M245 208l91-57 111 55"
          fill="none"
          stroke="#d89570"
          strokeWidth="3"
        />
        <path d="M217 245l58 15v87l-58-20Z" fill="#294b3c" />
        <path d="M225 254l42 11v68l-42-13Z" fill="#3c6250" />
        <circle cx="259" cy="299" r="3" fill="#efc987" />
        <path
          d="M371 253l80-21v66l-80 24Z"
          fill="#244d41"
          stroke="#eae5d3"
          strokeWidth="7"
        />
        <path d="M411 242v67M371 286l80-23" stroke="#92b8a0" strokeWidth="3" />
        <path
          d="M369 250l-24-12v69l24 14M454 231l22-24v70l-22 21"
          fill="#6b9678"
        />
        <path d="M292 283l22 7v27l-22-7Z" fill="#7e9680" />
        <path d="M336 398l45 20 146-55-22-19Z" fill="#82957b" />
        <ellipse cx="149" cy="339" rx="34" ry="12" fill="#21483e" />
        <path d="M115 335l5 44q30 17 59 0l5-44" fill="#72a8a0" />
        <ellipse cx="149" cy="335" rx="35" ry="12" fill="#a5d1c4" />
        <ellipse cx="149" cy="336" rx="28" ry="8" fill="#3d7c79" />
        <path
          d="M132 336q17-6 34 0"
          fill="none"
          stroke="#c9ece0"
          strokeWidth="2"
        />
        <path
          d="M553 314v64M553 342q-43-34-31-58 30 2 31 58M554 330q36-35 38-13-5 20-38 29"
          fill="#6c9670"
          stroke="#6c9670"
          strokeWidth="3"
        />
        <path d="M533 367h42l-6 35h-30Z" fill="#b57c58" />
        <path
          d="M71 358q-12-36-28-44M72 359q22-41 37-45"
          fill="none"
          stroke="#70976b"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path d="M58 355h30l-4 24H62Z" fill="#c09b73" />
        <path d="M30 403h577" stroke="#c6d8b8" opacity=".1" />
      </svg>
      {points.map(({ id, label, Icon, position }, index) => (
        <button
          key={id}
          type="button"
          onClick={() => onExplore(index)}
          aria-label={`${index + 1}. ${label}`}
          className={`absolute ${position} group flex size-11 items-center justify-center rounded-full border border-[#d8f0a8]/50 bg-[#d8f0a8] text-[#173a30] shadow-lg transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none`}
        >
          {completed.includes(id) ? <Check size={20} /> : <Icon size={20} />}
          <span className="pointer-events-none absolute top-full mt-2 hidden whitespace-nowrap rounded-lg bg-[#10251e] px-2 py-1 text-xs text-white group-hover:block group-focus-visible:block">
            {label}
          </span>
        </button>
      ))}
      <span className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/10 bg-[#10251e]/90 px-3 py-2 text-xs text-[#e1ebdc]">
        <ArrowUpRight size={13} />
        {hi
          ? "काल्पनिक दृश्य · 3 बिंदु खोजें"
          : "Fictional scene · explore 3 points"}
      </span>
    </div>
  );
}
