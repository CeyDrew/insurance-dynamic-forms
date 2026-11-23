-- Ids come from sequences (Hibernate's pooled optimizer reserves blocks of 50).
CREATE SEQUENCE form_definition_seq START WITH 1 INCREMENT BY 50;
CREATE SEQUENCE form_submission_seq START WITH 1 INCREMENT BY 50;

-- Form definitions are versioned: a published version never changes, edits open a new draft version.
CREATE TABLE form_definition (
    id            NUMBER(19)     PRIMARY KEY,
    form_key      VARCHAR2(100)  NOT NULL,
    version       NUMBER(10)     NOT NULL,
    title         VARCHAR2(300)  NOT NULL,
    status        VARCHAR2(20)   NOT NULL,
    definition    CLOB           NOT NULL,
    created_at    TIMESTAMP(6)   NOT NULL,
    updated_at    TIMESTAMP(6)   NOT NULL,
    published_at  TIMESTAMP(6),
    CONSTRAINT form_definition_key_version_uq UNIQUE (form_key, version),
    CONSTRAINT form_definition_status_ck CHECK (status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT form_definition_json_ck CHECK (definition IS JSON),
    CONSTRAINT form_definition_version_ck CHECK (version >= 1)
);

-- At most one draft per form: a function-based unique index ignores rows where the expression is NULL.
CREATE UNIQUE INDEX form_definition_one_draft_ux
    ON form_definition (CASE WHEN status = 'DRAFT' THEN form_key END);

-- Answers are stored as JSON and queried with JSON_VALUE / JSON_TABLE.
CREATE TABLE form_submission (
    id             NUMBER(19)     PRIMARY KEY,
    definition_id  NUMBER(19)     NOT NULL,
    form_key       VARCHAR2(100)  NOT NULL,
    version        NUMBER(10)     NOT NULL,
    answers        CLOB           NOT NULL,
    submitted_at   TIMESTAMP(6)   NOT NULL,
    CONSTRAINT form_submission_definition_fk FOREIGN KEY (definition_id) REFERENCES form_definition (id),
    CONSTRAINT form_submission_json_ck CHECK (answers IS JSON)
);

CREATE INDEX form_submission_form_ix ON form_submission (form_key, version, submitted_at);
