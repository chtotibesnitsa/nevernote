"""Reference classroom scripts for the synthetic trials.

Each line is (speaker_id, text). Speaker ids index Kokoro v0.19 voices:
0 af, 1 af_bella, 2 af_nicole, 3 af_sarah, 4 af_sky, 5 am_adam,
6 am_michael, 7 bf_emma, 8 bf_isabella, 9 bm_george, 10 bm_lewis.

The text deliberately packs in what students care about and models trip on:
dates, deadlines, numbers, chemistry and biology terms, names, and short
back-and-forth turns between several people.
"""

APES = [
    (9, "Alright everyone, let's get started. Today we're finishing unit three on the carbon cycle and then I'll go over what's due next week."),
    (9, "So who can tell me where carbon is stored for the longest period of time?"),
    (1, "Sedimentary rock, like limestone?"),
    (9, "Good. Limestone holds onto carbon for millions of years. What about fossil fuels?"),
    (5, "Coal, oil and natural gas."),
    (9, "Exactly. Now, decomposition releases carbon dioxide back into the atmosphere through cellular respiration by bacteria and fungi."),
    (3, "Wait, so decomposition doesn't store carbon at all?"),
    (9, "Right, it's a source, not a sink. Write that down because it will be on the quiz."),
    (9, "Okay, logistics. Your lab report on the photosynthesis experiment is due Friday, October twenty fourth, by eleven fifty nine p.m. on Canvas."),
    (6, "Is that the one with the spinach leaf disks?"),
    (9, "Yes, the leaf disk lab. Include your graph of oxygen production versus light intensity, and cite at least two sources."),
    (9, "We also have a unit three test next Tuesday. It's forty multiple choice questions and two free response questions."),
    (8, "Will the free response cover the nitrogen cycle too?"),
    (9, "Good question. Yes, nitrogen fixation, nitrification and denitrification are all fair game."),
    (9, "Remember that ammonia gets converted to nitrites and then nitrates by nitrifying bacteria."),
    (1, "Can we use a calculator on the test?"),
    (9, "You can use a four function calculator, but not a graphing calculator."),
    (9, "One more thing. The field trip permission slip for the Chesapeake Bay watershed trip is due November third, and it costs twenty five dollars."),
    (5, "What time does the bus leave?"),
    (9, "The bus leaves at seven thirty a.m. sharp from the north parking lot, so don't be late."),
]

CHEM = [
    (7, "Today we're talking about Le Chatelier's principle and how equilibrium systems respond to stress."),
    (7, "If you increase the concentration of a reactant, the equilibrium shifts to the right to consume the added reactant."),
    (10, "What happens if you increase the pressure?"),
    (7, "The equilibrium shifts toward the side with fewer moles of gas. In the Haber process, three moles of hydrogen and one mole of nitrogen make two moles of ammonia."),
    (4, "So higher pressure favors ammonia?"),
    (7, "Exactly. But temperature is different, because it actually changes the value of the equilibrium constant K."),
    (7, "The reaction is exothermic, with a delta H of negative ninety two kilojoules per mole."),
    (2, "So raising the temperature lowers the yield?"),
    (7, "Yes. Problem set seven is due Monday, and office hours are Wednesday from three to four thirty in room two fourteen."),
]


def flatten(script):
    return " ".join(t for _, t in script)
