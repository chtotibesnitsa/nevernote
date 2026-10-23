// Class vocabulary that speech engines mishear: subject terms, names and
// formulas from US high school and intro college courses. Live engines are
// biased toward these words (browser phrase hints, cloud key terms), so
// "mitosis" doesn't come out as "my toast is".

export type Subject =
  | "biology"
  | "chemistry"
  | "physics"
  | "environmental"
  | "earth"
  | "math"
  | "us-history"
  | "world-history"
  | "government"
  | "economics"
  | "psychology"
  | "english"
  | "computer-science"
  | "spanish"
  | "french"
  | "art-music"
  | "health";

export const VOCAB: Record<Subject, string[]> = {
  biology: [
    "mitosis", "meiosis", "cytokinesis", "interphase", "prophase", "metaphase", "anaphase", "telophase", "chromatid", "centromere",
    "chromosome", "homologous", "allele", "genotype", "phenotype", "heterozygous", "homozygous", "Punnett square", "Mendel", "codominance",
    "DNA", "RNA", "mRNA", "tRNA", "ribosome", "transcription", "translation", "codon", "anticodon", "polymerase",
    "photosynthesis", "chloroplast", "chlorophyll", "thylakoid", "stroma", "Calvin cycle", "cellular respiration", "glycolysis", "Krebs cycle", "electron transport chain",
    "ATP", "ADP", "NADH", "mitochondria", "endoplasmic reticulum", "Golgi apparatus", "lysosome", "vacuole", "cytoplasm", "nucleolus",
    "prokaryote", "eukaryote", "osmosis", "diffusion", "active transport", "homeostasis", "enzyme", "substrate", "denature", "catalyst",
    "natural selection", "Darwin", "adaptation", "speciation", "phylogeny", "cladogram", "taxonomy", "homeostasis", "hormone", "neuron",
  ],
  chemistry: [
    "stoichiometry", "mole", "molarity", "molality", "Avogadro's number", "limiting reactant", "percent yield", "empirical formula", "molecular formula", "titration",
    "covalent", "ionic", "metallic bond", "electronegativity", "valence electrons", "Lewis structure", "VSEPR", "hybridization", "sigma bond", "pi bond",
    "isotope", "isotopes", "atomic mass", "periodic table", "halogen", "noble gas", "alkali metal", "transition metal", "lanthanide", "actinide",
    "endothermic", "exothermic", "enthalpy", "entropy", "Gibbs free energy", "Hess's law", "calorimetry", "activation energy", "equilibrium", "Le Chatelier's principle",
    "acid", "base", "pH", "pOH", "buffer", "Bronsted-Lowry", "conjugate base", "oxidation", "reduction", "redox",
    "ideal gas law", "Boyle's law", "Charles's law", "kinetic molecular theory", "precipitate", "solubility", "electrolyte", "catalyst", "half-life", "orbital",
  ],
  physics: [
    "velocity", "acceleration", "displacement", "kinematics", "projectile motion", "Newton's laws", "inertia", "net force", "free body diagram", "friction",
    "momentum", "impulse", "kinetic energy", "potential energy", "conservation of energy", "work", "joule", "watt", "newton", "torque",
    "centripetal", "angular momentum", "rotational inertia", "simple harmonic motion", "pendulum", "amplitude", "frequency", "wavelength", "hertz", "Doppler effect",
    "Coulomb's law", "electric field", "voltage", "current", "resistance", "Ohm's law", "capacitor", "circuit", "magnetic field", "electromagnetic induction",
    "refraction", "reflection", "diffraction", "interference", "photon", "quantum", "relativity", "Einstein", "vector", "scalar",
  ],
  environmental: [
    "APES", "biome", "ecosystem", "biodiversity", "trophic level", "food web", "primary producer", "consumer", "decomposer", "keystone species",
    "carbon cycle", "nitrogen cycle", "phosphorus cycle", "hydrologic cycle", "carbon sink", "carbon sequestration", "greenhouse effect", "greenhouse gas", "methane", "nitrous oxide",
    "fossil fuels", "biofuel", "biofuels", "biomass", "ethanol", "renewable", "nonrenewable", "petroleum", "fracking", "photovoltaic",
    "monoculture", "monocropping", "crop rotation", "fertilizer", "eutrophication", "algal bloom", "dead zone", "pesticide", "bioaccumulation", "biomagnification",
    "deforestation", "desertification", "urbanization", "urban sprawl", "carrying capacity", "logistic growth", "exponential growth", "demographic transition", "ozone", "acid rain",
    "watershed", "aquifer", "groundwater", "irrigation", "salinization", "sustainability", "tragedy of the commons", "invasive species", "succession", "Industrial Revolution",
  ],
  earth: [
    "plate tectonics", "subduction", "convergent boundary", "divergent boundary", "transform boundary", "magma", "lava", "igneous", "sedimentary", "metamorphic",
    "erosion", "weathering", "deposition", "lithosphere", "asthenosphere", "mantle", "seismic wave", "epicenter", "Richter scale", "Coriolis effect",
    "troposphere", "stratosphere", "humidity", "front", "barometric pressure", "El Nino", "La Nina", "hurricane", "jet stream", "latitude", "longitude",
  ],
  math: [
    "derivative", "integral", "antiderivative", "limit", "continuity", "chain rule", "product rule", "quotient rule", "L'Hopital's rule", "Riemann sum",
    "polynomial", "quadratic", "quadratic formula", "discriminant", "factoring", "exponent", "logarithm", "natural log", "asymptote", "domain", "range",
    "sine", "cosine", "tangent", "secant", "cosecant", "cotangent", "radian", "unit circle", "Pythagorean theorem", "hypotenuse",
    "matrix", "vector", "determinant", "slope", "y-intercept", "parabola", "hyperbola", "ellipse", "congruent", "theorem",
    "mean", "median", "mode", "standard deviation", "variance", "normal distribution", "z-score", "p-value", "null hypothesis", "regression",
    "integer", "rational", "irrational", "coefficient", "sigma", "theta", "pi", "delta", "summation", "inequality",
  ],
  "us-history": [
    "APUSH", "Constitution", "Bill of Rights", "Declaration of Independence", "Articles of Confederation", "Federalist Papers", "Federalists", "Anti-Federalists", "Jefferson", "Hamilton",
    "Louisiana Purchase", "Manifest Destiny", "Missouri Compromise", "Compromise of 1850", "Kansas-Nebraska Act", "Dred Scott", "Emancipation Proclamation", "Reconstruction", "Jim Crow", "Plessy v. Ferguson",
    "Gilded Age", "Progressive Era", "Industrial Revolution", "Great Depression", "New Deal", "Roosevelt", "Pearl Harbor", "Cold War", "containment", "McCarthyism",
    "civil rights", "Brown v. Board of Education", "Martin Luther King", "Montgomery bus boycott", "Vietnam", "Watergate", "Reagan", "abolitionist", "suffrage", "Seneca Falls",
  ],
  "world-history": [
    "Mesopotamia", "Hammurabi", "pharaoh", "Byzantine", "Ottoman", "Mughal", "Ming dynasty", "Qing dynasty", "Tang dynasty", "Mongols",
    "feudalism", "Renaissance", "Reformation", "Enlightenment", "absolutism", "mercantilism", "imperialism", "colonialism", "nationalism", "industrialization",
    "French Revolution", "Napoleon", "Bolshevik", "Treaty of Versailles", "fascism", "totalitarianism", "Holocaust", "decolonization", "apartheid", "globalization",
  ],
  government: [
    "federalism", "separation of powers", "checks and balances", "judicial review", "Marbury v. Madison", "Supreme Court", "Congress", "filibuster", "gerrymandering", "Electoral College",
    "amendment", "due process", "equal protection", "First Amendment", "Fourteenth Amendment", "civil liberties", "civil rights", "precedent", "stare decisis", "executive order",
    "bicameral", "legislative", "executive", "judicial", "veto", "impeachment", "lobbying", "political action committee", "primary election", "referendum",
  ],
  economics: [
    "supply and demand", "equilibrium price", "elasticity", "opportunity cost", "marginal cost", "marginal benefit", "comparative advantage", "absolute advantage", "GDP", "inflation",
    "deflation", "recession", "unemployment", "monetary policy", "fiscal policy", "Federal Reserve", "interest rate", "tariff", "subsidy", "monopoly",
    "oligopoly", "perfect competition", "externality", "consumer surplus", "producer surplus", "price ceiling", "price floor", "aggregate demand", "aggregate supply", "Keynesian",
  ],
  psychology: [
    "classical conditioning", "operant conditioning", "Pavlov", "Skinner", "reinforcement", "punishment", "cognitive dissonance", "Freud", "id", "superego",
    "neurotransmitter", "dopamine", "serotonin", "amygdala", "hippocampus", "cerebral cortex", "frontal lobe", "schema", "Piaget", "Erikson",
    "Maslow", "hierarchy of needs", "confirmation bias", "heuristic", "placebo", "correlation", "independent variable", "dependent variable", "sample", "hypothesis",
  ],
  english: [
    "protagonist", "antagonist", "foreshadowing", "irony", "dramatic irony", "symbolism", "metaphor", "simile", "personification", "alliteration",
    "allusion", "hyperbole", "onomatopoeia", "imagery", "theme", "motif", "tone", "diction", "syntax", "rhetoric",
    "ethos", "pathos", "logos", "thesis", "claim", "counterargument", "iambic pentameter", "sonnet", "soliloquy", "Shakespeare",
    "Gatsby", "Fitzgerald", "Steinbeck", "Orwell", "Hemingway", "Toni Morrison", "Odyssey", "Macbeth", "Hamlet", "MLA",
  ],
  "computer-science": [
    "algorithm", "variable", "boolean", "integer", "string", "array", "ArrayList", "function", "method", "parameter",
    "recursion", "iteration", "loop", "conditional", "object", "class", "inheritance", "polymorphism", "encapsulation", "abstraction",
    "binary", "hexadecimal", "byte", "Big O", "binary search", "sorting", "Java", "Python", "JavaScript", "compiler",
  ],
  spanish: ["preterite", "imperfect", "subjunctive", "conjugation", "ser", "estar", "por", "para", "reflexive verb", "direct object pronoun", "indirect object pronoun", "vocabulario"],
  french: ["passé composé", "imparfait", "subjonctif", "conjugation", "être", "avoir", "reflexive verb", "agreement", "vocabulaire"],
  "art-music": ["chiaroscuro", "perspective", "Renaissance", "Baroque", "Impressionism", "tempo", "crescendo", "staccato", "legato", "major scale", "minor scale", "dynamics"],
  health: ["nutrition", "carbohydrate", "protein", "calorie", "cardiovascular", "immune system", "vaccine", "antibiotic", "mental health", "CPR"],
};

/** Words in a class or folder name that tell which subject it is. */
const HINTS: [RegExp, Subject[]][] = [
  [/\b(bio|biology|anatomy|physiology|life science|genetics)\b/i, ["biology"]],
  [/\b(chem|chemistry)\b/i, ["chemistry"]],
  [/\b(phys|physics)\b/i, ["physics"]],
  [/\b(apes|environmental|enviro|ecology)\b/i, ["environmental", "biology"]],
  [/\b(earth|geology|geo science|weather|meteorology)\b/i, ["earth"]],
  [/\b(math|algebra|geometry|calc|calculus|precalc|pre-calc|trig|trigonometry|stats|statistics)\b/i, ["math"]],
  [/\b(apush|us history|u\.s\. history|american history)\b/i, ["us-history"]],
  [/\b(world history|whap|euro|european history|global)\b/i, ["world-history"]],
  [/\b(gov|government|civics|politics|apgov)\b/i, ["government"]],
  [/\b(econ|economics|micro|macro)\b/i, ["economics"]],
  [/\b(psych|psychology|sociology)\b/i, ["psychology"]],
  [/\b(english|lit|literature|ela|language|lang|writing|rhetoric)\b/i, ["english"]],
  [/\b(cs|csa|csp|computer|coding|programming)\b/i, ["computer-science"]],
  [/\b(spanish|español)\b/i, ["spanish"]],
  [/\b(french|français)\b/i, ["french"]],
  [/\b(art|music|band|choir|orchestra)\b/i, ["art-music"]],
  [/\b(health|pe|nutrition)\b/i, ["health"]],
];

export function subjectsOf(name = ""): Subject[] {
  const out = new Set<Subject>();
  for (const [re, subs] of HINTS) if (re.test(name)) subs.forEach((s) => out.add(s));
  return [...out];
}

/**
 * Terms to bias a speech engine toward for one class, most useful first.
 * With a known subject: that subject's terms, then a few from the rest. With
 * none: an even mix across every subject. `extra` (names the student added,
 * words from earlier notes in this class) always comes first.
 */
export function classTerms(name = "", max = 100, extra: string[] = []): string[] {
  const subs = subjectsOf(name);
  const lists = subs.length ? subs.map((s) => VOCAB[s]) : Object.values(VOCAB);
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (t: string) => {
    const k = t.toLowerCase();
    if (!seen.has(k) && out.length < max) {
      seen.add(k);
      out.push(t);
    }
  };
  extra.forEach(add);
  // Round-robin across the chosen lists so each subject gets its most common terms in.
  for (let i = 0; out.length < max && lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) add(l[i]);
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Writes class terms the way they're spelled: "dna" -> "DNA", "apes" class ->
 * "APES", "le chateliers principle" -> "Le Chatelier's principle",
 * "krebs cycle" -> "Krebs cycle". Only terms with capitals, apostrophes or
 * hyphens, and only whole-word matches, so ordinary words are never touched.
 */
export function fixTerms(text: string, terms: string[]): string {
  let out = text;
  for (const t of terms) {
    if (!/[A-Z'’-]/.test(t) || t.length < 2) continue;
    // Short all-caps terms (pH, ATP, GDP) only when spoken as their own word; skip ones that are everyday words.
    if (/^(id|pi|ser|por|para|art|music|band|work|base|front|mode|range|limit|class|string|object|loop|method|function|array|sample)$/i.test(t)) continue;
    const pattern = t
      .split(/[\s-]+/)
      .map((w) => esc(w.replace(/['’]s$/, "")).replace(/['’]/g, "['’]?") + (/['’]s$/.test(w) ? "(?:['’]?s)?" : ""))
      .join("[\\s-]+");
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "giu"), t);
  }
  return out;
}
