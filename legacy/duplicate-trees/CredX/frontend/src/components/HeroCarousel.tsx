import { FileText, Globe, Activity } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const slides = [
  {
    title: "From scattered evidence to one sanction-ready view",
    description:
      "Ingest files, detect risk cues, and refresh decisioning outputs without forcing the user through five disconnected screens.",
    accent: "Ingestion Workflow",
    meta: ["GST", "Bank", "Annual", "Primary notes"],
    icon: FileText,
  },
  {
    title: "Research that feels like a credit manager, not a keyword dump",
    description:
      "Promoter, sector, regulatory, and litigation cues stay visible in the same decision context as the uploaded evidence.",
    accent: "Research Intelligence",
    meta: ["Promoter graph", "Sector watch", "Legal screening"],
    icon: Globe,
  },
  {
    title: "Explainable recommendationing with a committee-friendly trace",
    description:
      "Limit, pricing, and rejection logic are surfaced as drivers, adjustments, and monitoring triggers instead of long narrative blocks.",
    accent: "Decision Trace",
    meta: ["Five Cs", "Risk premium", "CAM output"],
    icon: Activity,
  },
];

const HeroCarousel = () => {
  return (
    <div className="relative">
      <Carousel opts={{ loop: true }} className="w-full">
        <CarouselContent>
          {slides.map((slide) => {
            const Icon = slide.icon;
            return (
              <CarouselItem key={slide.title}>
                <div className="surface-dark soft-grid relative overflow-hidden p-6 md:p-8">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-400/12 blur-3xl" />
                  <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-blue-500/14 blur-3xl" />

                  <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
                    <div className="space-y-5">
                      <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-200">
                        {slide.accent}
                      </div>
                      <div className="space-y-3">
                        <h2 className="max-w-3xl text-3xl font-semibold leading-tight text-white md:text-4xl">
                          {slide.title}
                        </h2>
                        <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                          {slide.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {slide.meta.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs text-slate-200"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-[28px] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md">
                      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/10 p-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                            Active layer
                          </p>
                          <p className="mt-1 text-sm font-medium text-white">
                            {slide.accent}
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.08] p-4">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
                            Time to insight
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-white">&lt;30m</p>
                        </div>
                        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.08] p-4">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
                            Decision mode
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-white">Traceable</p>
                        </div>
                        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.08] p-4">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
                            Core output
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-white">CAM</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>

        <CarouselPrevious className="-left-3 h-10 w-10 border border-slate-200 bg-white/90 text-slate-700 shadow-md hover:bg-white" />
        <CarouselNext className="-right-3 h-10 w-10 border border-slate-200 bg-white/90 text-slate-700 shadow-md hover:bg-white" />
      </Carousel>
    </div>
  );
};

export default HeroCarousel;
