export interface BuildInput
{
    u_id: number;
    c_id: number;
    w_id: number;
    ua_id_flower: string;
    ua_id_feather: string;
    ua_id_sands: string;
    ua_id_goblet: string;
    ua_id_circlet: string;
}

// for database results
export interface Build extends BuildInput
{
    ub_id: string;
}

export interface ArtifactInput
{
    u_id: number;
    a_id: number;
    mainstat:
    {
        prop: string;
        value: number;
    };
    substats:
    {
        prop: string;
        value: number;
    }[];
}

// for database results
export interface Artifact extends ArtifactInput
{
    ua_id: string;
}

export interface User {
    u_id: number;
    nickname: string;
}

export interface Character {
    id: number;
    c_id: number;
    name: string;
    icon_url: string;
    rarity: number;
    element: string;
    c_class: string;
}

export interface Weapon {
    id: number;
    w_id: number;
    name: string;
    icon_url: string;
    rarity: number;
    w_class: string;
}