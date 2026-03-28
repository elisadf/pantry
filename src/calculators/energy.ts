export function convertKcalToKj(kcal: number): number {
    return kcal * 4.184;
}

export function convertKjToKcal(kj: number): number {
    return kj / 4.184;
}
