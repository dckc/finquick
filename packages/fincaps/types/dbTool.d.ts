export function makeDBTool(db: SqliteDB): {
    getTable: (table: string, where?: Record<string, unknown>) => {
        readOnly: () => {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
        subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        /** @param {Record<string, unknown>} fields */
        insert: (fields: Record<string, unknown>) => void;
        /**
         * @param {Record<string, unknown>} keyFields
         * @param {Record<string, unknown>} dataFields
         */
        upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
        info: () => {
            table: string;
            where: Record<string, unknown>;
        };
        query: (keyFields?: {}) => unknown[];
        /** @param {Record<string, unknown>} keyFields */
        select1: (keyFields: Record<string, unknown>) => {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        }>;
    } & import("@endo/eventual-send").RemotableBrand<{}, {
        readOnly: () => {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
        subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        /** @param {Record<string, unknown>} fields */
        insert: (fields: Record<string, unknown>) => void;
        /**
         * @param {Record<string, unknown>} keyFields
         * @param {Record<string, unknown>} dataFields
         */
        upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
        info: () => {
            table: string;
            where: Record<string, unknown>;
        };
        query: (keyFields?: {}) => unknown[];
        /** @param {Record<string, unknown>} keyFields */
        select1: (keyFields: Record<string, unknown>) => {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        }>;
    }>;
    lookup: (...path: any[]) => {
        readOnly: () => {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
        subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        /** @param {Record<string, unknown>} fields */
        insert: (fields: Record<string, unknown>) => void;
        /**
         * @param {Record<string, unknown>} keyFields
         * @param {Record<string, unknown>} dataFields
         */
        upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
        info: () => {
            table: string;
            where: Record<string, unknown>;
        };
        query: (keyFields?: {}) => unknown[];
        /** @param {Record<string, unknown>} keyFields */
        select1: (keyFields: Record<string, unknown>) => {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        }>;
    } & import("@endo/eventual-send").RemotableBrand<{}, {
        readOnly: () => {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
        subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        /** @param {Record<string, unknown>} fields */
        insert: (fields: Record<string, unknown>) => void;
        /**
         * @param {Record<string, unknown>} keyFields
         * @param {Record<string, unknown>} dataFields
         */
        upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
        info: () => {
            table: string;
            where: Record<string, unknown>;
        };
        query: (keyFields?: {}) => unknown[];
        /** @param {Record<string, unknown>} keyFields */
        select1: (keyFields: Record<string, unknown>) => {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        }>;
    }>;
} & import("@endo/eventual-send").RemotableBrand<{}, {
    getTable: (table: string, where?: Record<string, unknown>) => {
        readOnly: () => {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
        subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        /** @param {Record<string, unknown>} fields */
        insert: (fields: Record<string, unknown>) => void;
        /**
         * @param {Record<string, unknown>} keyFields
         * @param {Record<string, unknown>} dataFields
         */
        upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
        info: () => {
            table: string;
            where: Record<string, unknown>;
        };
        query: (keyFields?: {}) => unknown[];
        /** @param {Record<string, unknown>} keyFields */
        select1: (keyFields: Record<string, unknown>) => {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        }>;
    } & import("@endo/eventual-send").RemotableBrand<{}, {
        readOnly: () => {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
        subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        /** @param {Record<string, unknown>} fields */
        insert: (fields: Record<string, unknown>) => void;
        /**
         * @param {Record<string, unknown>} keyFields
         * @param {Record<string, unknown>} dataFields
         */
        upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
        info: () => {
            table: string;
            where: Record<string, unknown>;
        };
        query: (keyFields?: {}) => unknown[];
        /** @param {Record<string, unknown>} keyFields */
        select1: (keyFields: Record<string, unknown>) => {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        }>;
    }>;
    lookup: (...path: any[]) => {
        readOnly: () => {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
        subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        /** @param {Record<string, unknown>} fields */
        insert: (fields: Record<string, unknown>) => void;
        /**
         * @param {Record<string, unknown>} keyFields
         * @param {Record<string, unknown>} dataFields
         */
        upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
        info: () => {
            table: string;
            where: Record<string, unknown>;
        };
        query: (keyFields?: {}) => unknown[];
        /** @param {Record<string, unknown>} keyFields */
        select1: (keyFields: Record<string, unknown>) => {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        }>;
    } & import("@endo/eventual-send").RemotableBrand<{}, {
        readOnly: () => {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
        subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
        /** @param {Record<string, unknown>} fields */
        insert: (fields: Record<string, unknown>) => void;
        /**
         * @param {Record<string, unknown>} keyFields
         * @param {Record<string, unknown>} dataFields
         */
        upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
        info: () => {
            table: string;
            where: Record<string, unknown>;
        };
        query: (keyFields?: {}) => unknown[];
        /** @param {Record<string, unknown>} keyFields */
        select1: (keyFields: Record<string, unknown>) => {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            get: () => unknown;
            /** @param {Record<string, unknown>} dataFields */
            update: (dataFields: Record<string, unknown>) => void;
        }>;
    }>;
}>;
export function make(_guestP: any): Promise<{
    lookup: (path: any, opts?: {}) => {
        getTable: (table: string, where?: Record<string, unknown>) => {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
        lookup: (...path: any[]) => {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
    } & import("@endo/eventual-send").RemotableBrand<{}, {
        getTable: (table: string, where?: Record<string, unknown>) => {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
        lookup: (...path: any[]) => {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
    }>;
} & import("@endo/eventual-send").RemotableBrand<{}, {
    lookup: (path: any, opts?: {}) => {
        getTable: (table: string, where?: Record<string, unknown>) => {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
        lookup: (...path: any[]) => {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
    } & import("@endo/eventual-send").RemotableBrand<{}, {
        getTable: (table: string, where?: Record<string, unknown>) => {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
        lookup: (...path: any[]) => {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        } & import("@endo/eventual-send").RemotableBrand<{}, {
            readOnly: () => {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                info: () => {
                    table: string;
                    where: Record<string, unknown>;
                };
                readOnly: () => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
                query: (keyFields?: {}) => unknown[];
                /** @param {Record<string, unknown>} keyFields */
                select1: (keyFields: Record<string, unknown>) => {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                } & import("@endo/eventual-send").RemotableBrand<{}, {
                    get: () => unknown;
                    /** @param {Record<string, unknown>} dataFields */
                    update: (dataFields: Record<string, unknown>) => void;
                }>;
            }>;
            subTable: (keyFields: any) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            lookup: (...path: any[]) => any & import("@endo/eventual-send").RemotableBrand<{}, any>;
            /** @param {Record<string, unknown>} fields */
            insert: (fields: Record<string, unknown>) => void;
            /**
             * @param {Record<string, unknown>} keyFields
             * @param {Record<string, unknown>} dataFields
             */
            upsert: (keyFields: Record<string, unknown>, dataFields: Record<string, unknown>) => void;
            info: () => {
                table: string;
                where: Record<string, unknown>;
            };
            query: (keyFields?: {}) => unknown[];
            /** @param {Record<string, unknown>} keyFields */
            select1: (keyFields: Record<string, unknown>) => {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            } & import("@endo/eventual-send").RemotableBrand<{}, {
                get: () => unknown;
                /** @param {Record<string, unknown>} dataFields */
                update: (dataFields: Record<string, unknown>) => void;
            }>;
        }>;
    }>;
}>>;
export type SqliteDB = import('better-sqlite3').Database;
