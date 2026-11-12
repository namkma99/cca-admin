export function syntheticBank(count = 90) {
  return {
    schemaVersion: 1,
    topics: ['cca-f', 'ccao-f', 'ccar-p'].map((id) => ({
      id,
      questionCount: count,
      readyQuestionCount: count,
      questions: Array.from({ length: count }, (_, index) => ({
        id: `${id}-${String(index + 1).padStart(3, '0')}`,
        source: { number: index + 1 },
        type: index % 3 === 0 ? 'multiple_response' : 'single_choice',
        prompt: `Synthetic ${id} question ${index + 1}?`,
        choices: [
          { id: 'A', text: 'Synthetic option A' },
          { id: 'B', text: 'Synthetic option B' },
          { id: 'C', text: 'Synthetic option C' },
        ],
        correctChoiceIds: index % 3 === 0 ? ['A', 'B'] : ['A'],
        status: 'ready',
      })),
    })),
  };
}
