export interface Build {
    u_id: number;
    c_id: number;
    w_id: number;
    a1_flower: number;
    a2_feather: number;
    a3_sands: number;
    a4_goblet: number;
    a5_circlet: number;
}

export interface Artifact {
    u_id: number;
    a_id: number;
    mainstat: {
        prop: string;
        value: number;
    };
    substats: {
        prop: string;
        value: number;
    }[];
}
