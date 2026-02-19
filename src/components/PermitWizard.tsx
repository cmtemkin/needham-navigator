"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  FileText,
  DollarSign,
  ClipboardList,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { useTown, useTownHref } from "@/lib/town-context";
import { useI18n } from "@/lib/i18n";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WizardQuestion {
  id: string;
  text: string;
  options: { label: string; value: string }[];
}

interface PermitResult {
  permits: { name: string; description: string }[];
  estimatedFees: { item: string; amount: string }[];
  requiredDocuments: string[];
  timeline: string;
  department: string;
  departmentPhone: string;
  tips: string[];
}

type ProjectType = "deck" | "fence" | "renovation" | "addition";

/* ------------------------------------------------------------------ */
/*  Decision-tree data                                                 */
/* ------------------------------------------------------------------ */

const projectTypes: { key: ProjectType; icon: string; label: string; description: string }[] = [
  { key: "deck", icon: "\uD83C\uDFE1", label: "Build a Deck", description: "Attached or detached deck, patio, or porch" },
  { key: "fence", icon: "\uD83E\uDDF1", label: "Install a Fence", description: "New fence or replacement of an existing fence" },
  { key: "renovation", icon: "\uD83D\uDD28", label: "Home Renovation", description: "Kitchen, bathroom, or interior remodel" },
  { key: "addition", icon: "\uD83C\uDFD7\uFE0F", label: "Build an Addition", description: "Room addition, sunroom, or expanded living space" },
];

const questionsByProject: Record<ProjectType, WizardQuestion[]> = {
  deck: [
    {
      id: "attached",
      text: "Will the deck be attached to the house?",
      options: [
        { label: "Yes, attached to the house", value: "attached" },
        { label: "No, freestanding / detached", value: "detached" },
      ],
    },
    {
      id: "size",
      text: "What is the approximate size of the deck?",
      options: [
        { label: "Small (under 200 sq ft)", value: "small" },
        { label: "Medium (200 - 500 sq ft)", value: "medium" },
        { label: "Large (over 500 sq ft)", value: "large" },
      ],
    },
    {
      id: "height",
      text: "How high off the ground will the deck be?",
      options: [
        { label: "Ground level (under 30 inches)", value: "low" },
        { label: "Elevated (30 inches or more)", value: "elevated" },
      ],
    },
  ],
  fence: [
    {
      id: "height",
      text: "How tall will the fence be?",
      options: [
        { label: "Up to 4 feet", value: "short" },
        { label: "4 to 6 feet", value: "medium" },
        { label: "Over 6 feet", value: "tall" },
      ],
    },
    {
      id: "location",
      text: "Where will the fence be located relative to your property?",
      options: [
        { label: "Within my property lines", value: "interior" },
        { label: "On or near the property line", value: "boundary" },
        { label: "In the front yard", value: "front" },
      ],
    },
    {
      id: "material",
      text: "What material will the fence be?",
      options: [
        { label: "Wood", value: "wood" },
        { label: "Vinyl / PVC", value: "vinyl" },
        { label: "Chain link or metal", value: "metal" },
      ],
    },
  ],
  renovation: [
    {
      id: "type",
      text: "What type of renovation are you planning?",
      options: [
        { label: "Kitchen remodel", value: "kitchen" },
        { label: "Bathroom remodel", value: "bathroom" },
        { label: "Other interior renovation", value: "other" },
      ],
    },
    {
      id: "structural",
      text: "Will there be any structural changes (removing walls, new openings)?",
      options: [
        { label: "Yes, structural changes", value: "yes" },
        { label: "No, cosmetic changes only", value: "no" },
      ],
    },
    {
      id: "systems",
      text: "Will you be modifying electrical, plumbing, or gas systems?",
      options: [
        { label: "Yes, electrical work", value: "electrical" },
        { label: "Yes, plumbing work", value: "plumbing" },
        { label: "Yes, both electrical and plumbing", value: "both" },
        { label: "No system changes", value: "none" },
      ],
    },
  ],
  addition: [
    {
      id: "size",
      text: "What is the approximate size of the addition?",
      options: [
        { label: "Small (under 300 sq ft)", value: "small" },
        { label: "Medium (300 - 800 sq ft)", value: "medium" },
        { label: "Large (over 800 sq ft)", value: "large" },
      ],
    },
    {
      id: "stories",
      text: "How many stories will the addition be?",
      options: [
        { label: "Single story", value: "one" },
        { label: "Two stories", value: "two" },
      ],
    },
    {
      id: "foundation",
      text: "What type of foundation?",
      options: [
        { label: "Full foundation / basement", value: "full" },
        { label: "Slab on grade", value: "slab" },
        { label: "Crawl space", value: "crawl" },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Result calculation                                                 */
/* ------------------------------------------------------------------ */

function calculateResult(
  project: ProjectType,
  answers: Record<string, string>,
  townName: string,
  buildingDeptPhone: string
): PermitResult {
  switch (project) {
    case "deck": {
      const isAttached = answers.attached === "attached";
      const isElevated = answers.height === "elevated";
      const isLarge = answers.size === "large";

      const permits: PermitResult["permits"] = [
        {
          name: "Building Permit",
          description: `Required for all deck construction in ${townName}`,
        },
      ];
      if (isElevated) {
        permits.push({
          name: "Zoning Review",
          description:
            "Elevated decks may affect setback calculations and lot coverage",
        });
      }

      const costBase = answers.size === "small" ? 3000 : answers.size === "medium" ? 8000 : 20000;
      const permitFee = Math.max(150, Math.round(costBase / 1000) * 10);

      return {
        permits,
        estimatedFees: [
          { item: "Building Permit Fee", amount: `$${permitFee}` },
          { item: "Plan Review Fee", amount: "$50" },
        ],
        requiredDocuments: [
          "Building permit application (via ViewPoint Cloud)",
          "Plot plan showing deck location and setbacks (stamped by registered land surveyor)",
          isAttached
            ? "Structural building plans showing attachment details"
            : "Building plans with foundation details",
          "Workers\u2019 Compensation affidavit",
          "Debris Removal Form",
          ...(isLarge ? ["Engineered structural calculations"] : []),
        ],
        timeline: "Typical review: 2-4 weeks after submission",
        department: "Building Department",
        departmentPhone: buildingDeptPhone,
        tips: [
          "Submit electronically via ViewPoint Cloud",
          isElevated
            ? "Elevated decks must meet setback requirements for your zoning district"
            : "Ground-level decks still require a permit",
          "Schedule inspections at key stages: footing, framing, and final",
        ],
      };
    }

    case "fence": {
      const isTall = answers.height === "tall";
      const isFront = answers.location === "front";
      const isBoundary = answers.location === "boundary";

      const permits: PermitResult["permits"] = [
        {
          name: "Building Permit",
          description: `Required for new fence installation in ${townName}`,
        },
      ];
      if (isTall || isFront) {
        permits.push({
          name: "Zoning Board Review",
          description: isFront
            ? "Front yard fences have additional height restrictions (typically 4 ft max)"
            : "Fences over 6 feet require a variance from the Zoning Board",
        });
      }

      return {
        permits,
        estimatedFees: [
          { item: "Building Permit Fee", amount: "$150" },
          ...(isTall || isFront
            ? [{ item: "Zoning Board Application Fee", amount: "$200" }]
            : []),
        ],
        requiredDocuments: [
          "Building permit application (via ViewPoint Cloud)",
          "Plot plan showing fence location and property lines",
          "Fence specifications (height, material, style)",
          ...(isBoundary
            ? ["Property survey confirming boundary lines"]
            : []),
          "Workers\u2019 Compensation affidavit",
        ],
        timeline: isTall || isFront
          ? "4-8 weeks (includes Zoning Board hearing)"
          : "1-2 weeks for standard fence permits",
        department: "Building Department",
        departmentPhone: buildingDeptPhone,
        tips: [
          isBoundary
            ? "We strongly recommend getting a property survey before installing a fence on or near the property line"
            : "Confirm your fence will be fully within your property lines",
          isFront
            ? "Front yard fences are typically limited to 4 feet in height"
            : "Side and rear yard fences can be up to 6 feet without a variance",
          "Check with Dig Safe (811) before digging post holes",
        ],
      };
    }

    case "renovation": {
      const isStructural = answers.structural === "yes";
      const hasElectrical =
        answers.systems === "electrical" || answers.systems === "both";
      const hasPlumbing =
        answers.systems === "plumbing" || answers.systems === "both";
      const isKitchen = answers.type === "kitchen";
      const isBathroom = answers.type === "bathroom";

      const permits: PermitResult["permits"] = [];

      if (isStructural || hasElectrical || hasPlumbing) {
        permits.push({
          name: "Building Permit",
          description: "Required for any renovation involving structural, electrical, or plumbing work",
        });
      }
      if (hasElectrical) {
        permits.push({
          name: "Electrical Permit",
          description: "Required for new circuits, rewiring, or panel upgrades",
        });
      }
      if (hasPlumbing) {
        permits.push({
          name: "Plumbing Permit",
          description: "Required for new fixtures, pipe relocation, or drain modifications",
        });
      }
      if (isKitchen || isBathroom) {
        if (hasPlumbing || hasElectrical) {
          permits.push({
            name: "Gas Permit (if applicable)",
            description:
              "Required if modifying gas lines for stove, water heater, or dryer",
          });
        }
      }

      if (permits.length === 0) {
        permits.push({
          name: "No Permit Required",
          description:
            "Cosmetic renovations without structural, electrical, or plumbing changes generally do not require a permit",
        });
      }

      const costEstimate =
        isKitchen ? 30000 : isBathroom ? 15000 : 10000;
      const buildingFee = Math.max(150, Math.round(costEstimate / 1000) * 10);

      return {
        permits,
        estimatedFees:
          permits[0].name === "No Permit Required"
            ? [{ item: "No fees required", amount: "$0" }]
            : [
                { item: "Building Permit Fee", amount: `$${buildingFee}` },
                ...(hasElectrical
                  ? [{ item: "Electrical Permit Fee", amount: "$75-$150" }]
                  : []),
                ...(hasPlumbing
                  ? [{ item: "Plumbing Permit Fee", amount: "$75-$150" }]
                  : []),
              ],
        requiredDocuments:
          permits[0].name === "No Permit Required"
            ? ["No documents required for cosmetic-only renovations"]
            : [
                "Building permit application (via ViewPoint Cloud)",
                isStructural
                  ? "Structural plans stamped by a licensed engineer"
                  : "Floor plans showing proposed changes",
                "Workers\u2019 Compensation affidavit",
                "Debris Removal Form",
                ...(hasElectrical
                  ? ["Electrical plan with circuit details"]
                  : []),
                ...(hasPlumbing
                  ? ["Plumbing plan showing fixture locations"]
                  : []),
              ],
        timeline:
          permits[0].name === "No Permit Required"
            ? "No permit wait time"
            : isStructural
              ? "3-6 weeks for review"
              : "2-4 weeks for review",
        department: "Building Department",
        departmentPhone: buildingDeptPhone,
        tips:
          permits[0].name === "No Permit Required"
            ? [
                "Even without a permit, ensure work complies with building codes",
                "If the scope changes to include structural or system work, stop and apply for permits",
              ]
            : [
                "Submit electronically via ViewPoint Cloud",
                isStructural
                  ? "Structural work requires plans stamped by a licensed engineer"
                  : "Clearly mark all proposed changes on your plans",
                "Schedule inspections: rough inspection before closing walls, final after completion",
                ...(isKitchen || isBathroom
                  ? [
                      "Board of Health review may be required if adding a bathroom or modifying wastewater",
                    ]
                  : []),
              ],
      };
    }

    case "addition": {
      const isLarge = answers.size === "large";
      const isTwoStory = answers.stories === "two";

      const costEstimate =
        answers.size === "small" ? 80000 : answers.size === "medium" ? 150000 : 300000;
      const buildingFee = Math.max(150, Math.round(costEstimate / 1000) * 10);

      return {
        permits: [
          {
            name: "Building Permit",
            description: "Required for all additions",
          },
          {
            name: "Zoning Review",
            description:
              "Addition must comply with setback, FAR, and lot coverage requirements for your district",
          },
          {
            name: "Electrical Permit",
            description: "Required for new electrical service to the addition",
          },
          {
            name: "Plumbing Permit (if applicable)",
            description:
              "Required if the addition includes a bathroom, kitchen, or laundry",
          },
          ...(isLarge || isTwoStory
            ? [
                {
                  name: "Conservation Commission Review (if applicable)",
                  description:
                    "May be required if your property is near wetlands or flood zones",
                },
              ]
            : []),
        ],
        estimatedFees: [
          { item: "Building Permit Fee", amount: `$${buildingFee}` },
          { item: "Plan Review Fee", amount: "$100-$250" },
          { item: "Electrical Permit Fee", amount: "$100-$200" },
          { item: "Plumbing Permit Fee (if applicable)", amount: "$100-$200" },
        ],
        requiredDocuments: [
          "Building permit application (via ViewPoint Cloud)",
          "Architectural plans stamped by a licensed architect",
          "Structural engineering plans stamped by a licensed engineer",
          "Plot plan showing addition location, setbacks, and lot coverage (stamped survey)",
          "Title 5 septic compliance (if applicable)",
          "Energy code compliance documentation (stretch code)",
          "Workers\u2019 Compensation affidavit",
          "Debris Removal Form",
          ...(isTwoStory
            ? ["Height calculations relative to zoning district maximum"]
            : []),
        ],
        timeline: isLarge || isTwoStory
          ? "6-10 weeks for full plan review"
          : "4-6 weeks for plan review",
        department: "Building Department & Planning Department",
        departmentPhone: buildingDeptPhone,
        tips: [
          "Verify your project complies with your zoning district\u2019s dimensional requirements before starting plans",
          "The FAR (Floor Area Ratio) limit may restrict the size of your addition",
          isTwoStory
            ? "Two-story additions have maximum height restrictions based on your zoning district"
            : "Confirm the addition fits within required setbacks for your zone",
          "Consider scheduling a pre-application meeting with the Building Department",
          "Your town may follow the MA Stretch Energy Code \u2014 additions must meet enhanced energy efficiency standards",
        ],
      };
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PermitWizard() {
  const town = useTown();
  const { t } = useI18n();
  const chatHref = useTownHref("/chat");

  const townName = town.name.replace(/,\s*[A-Z]{2}$/i, "");
  const buildingDept = town.departments.find((d) =>
    d.name.toLowerCase().includes("building")
  );
  const buildingDeptPhone = buildingDept?.phone ?? town.departments[0]?.phone ?? "";

  const [selectedProject, setSelectedProject] = useState<ProjectType | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PermitResult | null>(null);

  const questions = selectedProject
    ? questionsByProject[selectedProject]
    : [];

  const totalSteps = questions.length;

  function handleProjectSelect(project: ProjectType) {
    setSelectedProject(project);
    setCurrentStep(0);
    setAnswers({});
    setResult(null);
  }

  function handleAnswer(questionId: string, value: string) {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setResult(calculateResult(selectedProject!, newAnswers, townName, buildingDeptPhone));
    }
  }

  function handleBack() {
    if (result) {
      setResult(null);
      return;
    }
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      setSelectedProject(null);
      setAnswers({});
    }
  }

  function handleReset() {
    setSelectedProject(null);
    setCurrentStep(0);
    setAnswers({});
    setResult(null);
  }

  /* ---------- Project selection ---------- */
  if (!selectedProject) {
    return (
      <div className="animate-msg-in">
        <h2 className="text-xl font-bold text-text-primary mb-1.5">
          {t("permits.select_project")}
        </h2>
        <p className="text-[14px] text-text-secondary mb-6">
          {t("permits.select_description")}
        </p>

        <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-3.5">
          {projectTypes.map((pt) => (
            <button
              key={pt.key}
              onClick={() => handleProjectSelect(pt.key)}
              className="flex items-start gap-3.5 p-5 bg-white border border-border-default rounded-xl text-left hover:border-primary hover:shadow-sm hover:-translate-y-px transition-all cursor-pointer group"
            >
              <span className="text-2xl mt-0.5">{pt.icon}</span>
              <div>
                <div className="text-[15px] font-semibold text-text-primary group-hover:text-primary transition-colors">
                  {pt.label}
                </div>
                <div className="text-[13px] text-text-secondary mt-0.5 leading-snug">
                  {pt.description}
                </div>
              </div>
              <ChevronRight
                size={16}
                className="ml-auto mt-1 text-text-muted group-hover:text-primary transition-colors shrink-0"
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ---------- Results ---------- */
  if (result) {
    return (
      <div className="animate-msg-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={20} className="text-success" />
              <h2 className="text-xl font-bold text-text-primary">
                {t("permits.summary_title")}
              </h2>
            </div>
            <p className="text-[13.5px] text-text-secondary">
              Based on your answers for:{" "}
              <span className="font-medium text-text-primary">
                {projectTypes.find((p) => p.key === selectedProject)?.label}
              </span>
            </p>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-[7px] text-[13px] font-medium text-text-secondary border border-border-default rounded-lg hover:border-primary hover:text-primary transition-all"
          >
            <RotateCcw size={13} />
            {t("permits.start_over")}
          </button>
        </div>

        {/* Permits needed */}
        <section className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList size={16} className="text-primary" />
            <h3 className="text-[15px] font-semibold text-text-primary">
              {t("permits.permits_needed")}
            </h3>
          </div>
          <div className="space-y-2">
            {result.permits.map((p) => (
              <div
                key={p.name}
                className="bg-white border border-border-light rounded-xl px-4 py-3 shadow-xs"
              >
                <div className="text-[14px] font-semibold text-text-primary">
                  {p.name}
                </div>
                <div className="text-[13px] text-text-secondary mt-0.5">
                  {p.description}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Estimated fees */}
        <section className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={16} className="text-primary" />
            <h3 className="text-[15px] font-semibold text-text-primary">
              {t("permits.estimated_fees")}
            </h3>
          </div>
          <div className="bg-white border border-border-light rounded-xl overflow-hidden shadow-xs">
            {result.estimatedFees.map((fee, i) => (
              <div
                key={fee.item}
                className={`flex justify-between px-4 py-2.5 text-[13.5px] ${
                  i > 0 ? "border-t border-border-light" : ""
                }`}
              >
                <span className="text-text-secondary">{fee.item}</span>
                <span className="font-semibold text-text-primary">
                  {fee.amount}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Required documents */}
        <section className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={16} className="text-primary" />
            <h3 className="text-[15px] font-semibold text-text-primary">
              {t("permits.required_docs")}
            </h3>
          </div>
          <div className="bg-white border border-border-light rounded-xl px-4 py-3 shadow-xs">
            <ul className="space-y-2">
              {result.requiredDocuments.map((doc) => (
                <li
                  key={doc}
                  className="flex gap-2 text-[13.5px] text-text-secondary"
                >
                  <CheckCircle2
                    size={14}
                    className="text-success shrink-0 mt-0.5"
                  />
                  {doc}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Timeline & Contact */}
        <section className="mb-5 flex gap-3.5 max-sm:flex-col">
          <div className="flex-1 bg-white border border-border-light rounded-xl px-4 py-3 shadow-xs">
            <div className="text-[12px] font-medium text-text-muted uppercase tracking-wide mb-1">
              {t("permits.timeline")}
            </div>
            <div className="text-[14px] font-semibold text-text-primary">
              {result.timeline}
            </div>
          </div>
          <div className="flex-1 bg-white border border-border-light rounded-xl px-4 py-3 shadow-xs">
            <div className="text-[12px] font-medium text-text-muted uppercase tracking-wide mb-1">
              {t("permits.contact")}
            </div>
            <div className="text-[14px] font-semibold text-text-primary">
              {result.department}
            </div>
            <div className="text-[13px] text-text-secondary">
              {result.departmentPhone}
            </div>
          </div>
        </section>

        {/* Tips */}
        {result.tips.length > 0 && (
          <section className="mb-5">
            <div className="bg-[rgba(212,175,55,0.08)] border border-accent/20 rounded-xl px-4 py-3.5">
              <div className="text-[13px] font-semibold text-text-primary mb-2">
                {t("permits.tips")}
              </div>
              <ul className="space-y-1.5">
                {result.tips.map((tip) => (
                  <li
                    key={tip}
                    className="text-[13px] text-text-secondary flex gap-2"
                  >
                    <span className="text-accent shrink-0">&#x2022;</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="flex gap-3 max-sm:flex-col">
          <a
            href={`${chatHref}?q=${encodeURIComponent(
              `I want to ${projectTypes.find((p) => p.key === selectedProject)?.label.toLowerCase()}. What else should I know about permits and requirements?`
            )}`}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white text-[14px] font-semibold rounded-xl hover:bg-primary-light transition-all"
          >
            {t("permits.ask_more")}
            <ArrowRight size={15} />
          </a>
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-2 px-5 py-3 border border-border-default text-[14px] font-medium text-text-secondary rounded-xl hover:border-primary hover:text-primary transition-all"
          >
            <RotateCcw size={14} />
            {t("permits.new_project")}
          </button>
        </div>

        {/* Disclaimer */}
        <p className="text-[11.5px] text-text-muted mt-5 leading-relaxed">
          {t("permits.disclaimer", { town: townName, phone: buildingDeptPhone })}
        </p>
      </div>
    );
  }

  /* ---------- Question steps ---------- */
  const currentQuestion = questions[currentStep];

  return (
    <div className="animate-msg-in">
      {/* Progress */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-[13px] font-medium text-text-secondary hover:text-primary transition-colors"
        >
          <ChevronLeft size={15} />
          {t("permits.back")}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-muted font-medium">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div
                key={`step-${i}`}
                className={`h-1.5 rounded-full transition-all ${
                  i <= currentStep
                    ? "w-6 bg-primary"
                    : "w-3 bg-border-default"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Project label */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/5 text-primary text-[12px] font-medium rounded-full mb-3">
        {projectTypes.find((p) => p.key === selectedProject)?.icon}{" "}
        {projectTypes.find((p) => p.key === selectedProject)?.label}
      </div>

      {/* Question */}
      <h2 className="text-lg font-bold text-text-primary mb-5">
        {currentQuestion.text}
      </h2>

      {/* Options */}
      <div className="space-y-2.5">
        {currentQuestion.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleAnswer(currentQuestion.id, opt.value)}
            className={`w-full flex items-center justify-between p-4 bg-white border rounded-xl text-left text-[14px] font-medium transition-all cursor-pointer group ${
              answers[currentQuestion.id] === opt.value
                ? "border-primary bg-[#F5F8FC] text-primary"
                : "border-border-default text-text-primary hover:border-primary hover:shadow-sm"
            }`}
          >
            {opt.label}
            <ChevronRight
              size={15}
              className="text-text-muted group-hover:text-primary transition-colors shrink-0"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
