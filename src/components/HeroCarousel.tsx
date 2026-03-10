import { FileText, Globe, Activity } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";

const slides = [
  {
    title: "Automated CAM Generation",
    description: "Reduce appraisal time from weeks to minutes.",
    accent: "Operational Efficiency",
    icon: FileText,
  },
  {
    title: "Deep Web-Scale Research",
    description: "Uncover hidden litigation and sector headwinds.",
    accent: "Risk Discovery",
    icon: Globe,
  },
  {
    title: "Explainable ML",
    description: "Transparent decisioning with GSTR-2A/3B reconciliation.",
    accent: "Audit-Ready Decisions",
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
                <Card className="overflow-hidden border border-blue-900/10 bg-gradient-to-r from-blue-900 to-blue-800 text-white shadow-lg">
                  <CardContent className="relative flex min-h-[160px] items-center px-6 py-8 md:min-h-[200px] md:px-10">
                    <div className="max-w-2xl space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-100">
                        {slide.accent}
                      </p>
                      <h2 className="text-2xl font-bold md:text-3xl">
                        {slide.title}
                      </h2>
                      <p className="text-sm text-blue-100 md:text-base">
                        {slide.description}
                      </p>
                    </div>
                    <div className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 md:block">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/10">
                        <Icon className="h-10 w-10 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            );
          })}
        </CarouselContent>

        <CarouselPrevious className="-left-3 h-9 w-9 border border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-50" />
        <CarouselNext className="-right-3 h-9 w-9 border border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-50" />
      </Carousel>
    </div>
  );
};

export default HeroCarousel;
