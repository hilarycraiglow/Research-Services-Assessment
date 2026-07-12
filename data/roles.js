// Role definitions for each audience in the assessment.
const ROLES = {
  library: {
    id: "library",
    label: "Library",
    subtitle: "Library leadership & service managers",
    color: "#0B2545",
    questions: [
      { key: "project_specific",
        text: () => "Can this service be identified specifically for an individual research project?",
        options: [
          { value: 2, label: "Yes" },
          { value: 0, label: "No" }
        ] },
      { key: "usage_scope",
        text: () => "Is this service used by all/most sponsored projects, or only some?",
        options: [
          { value: 2, label: "All / most" },
          { value: 1, label: "Some" }
        ] },
      { key: "researcher_request",
        text: () => "Is the service used or requested by a researcher for the unique needs of a specific project?",
        options: [
          { value: 2, label: "Yes" },
          { value: 0, label: "No" }
        ] },
      { key: "cost_tracking",
        text: () => "Does the library already track cost, time, or effort at the level of an individual project or researcher for this service?",
        options: [
          { value: 2, label: "Yes" },
          { value: 1, label: "Somewhat" },
          { value: 0, label: "No" }
        ] }
    ]
  },
  admin: {
    id: "admin",
    label: "Research Administration",
    subtitle: "Sponsored programs & research administrators",
    color: "#52733E",
    questions: [
      { key: "value", text: (s) => `Is ${s} valuable to your institution's research strategy?`,
        options: [
          { value: 2, label: "Yes" },
          { value: 1, label: "Not sure" },
          { value: 0, label: "No" }
        ] },
      { key: "compliance", text: (s) => `Does ${s} help satisfy grant compliance requirements?`,
        options: [
          { value: 2, label: "Yes" },
          { value: 1, label: "Somewhat" },
          { value: 0, label: "No" }
        ] },
      { key: "chargeable", text: (s) => `If there were an allocable, documented per project cost for this service, would you be open to direct charging?`,
        options: [
          { value: 2, label: "Yes" },
          { value: 1, label: "Maybe" },
          { value: 0, label: "No" }
        ] }
    ]
  },
  costing: {
    id: "costing",
    label: "Institutional Finance/Costing",
    subtitle: "Institutional research finance or cost accounting teams",
    color: "#1F87A6",
    questions: [
      { key: "idc",
        text: "Do you include the cost of this service in your Library Cost Pool for IDC calculations?" },
      { key: "costcenter",
        text: "Do you have an existing cost center, or similar mechanism, that could be used to direct charge departments or grants for this service?" },
      { key: "phase_in",
        text: "Is there a phase-in or pilot path to direct charge this service before a broader implementation?" }
    ]
  }
};

const ROLE_ORDER = ["library", "admin", "costing"];
