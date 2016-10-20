export default function fieldLocator(document, field) {
    if (!field) return false;

    const field_levels = field.split('.');

    return field_levels.reduce((currentLevelInDocument, currentField) => {
        if (typeof currentLevelInDocument[currentField] !== 'undefined') {
            return currentLevelInDocument[currentField];
        }

        return false;
    }, document);
}