// Role definitions for each audience in the assessment.
const ROLES = {
  library: {
    id: "library",
    label: "Library",
    subtitle: "Library leadership & service managers",
    color: "#0B2545",
    questions: [
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
    label: "Finance/Costing",
    subtitle: "Research finance & cost accounting teams",
    color: "#1F87A6",
    questions: [
      { key: "idc",
        text: "Do you recover the costs for these library services in your indirect cost rate?" },
      { key: "costcenter",
        text: "Do you have an existing cost center (or similar mechanism) that could be used to direct charge departments or grants for this service?" },
      { key: "threshold",
        text: "Do you have a threshold amount to consider moving a library service from the IDC to direct charging?",
        options: [
          { value: 2, label: "Yes" },
          { value: 1, label: "Depends" },
          { value: 0, label: "No" }
        ],
        hasTextInput: true,
        textInputLabel: "Specify the threshold (optional):",
        textInputKey: "threshold_text"
      }
    ]
  }
};

const ROLE_ORDER = ["library", "admin", "costing"];
