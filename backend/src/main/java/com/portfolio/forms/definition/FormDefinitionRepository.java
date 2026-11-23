package com.portfolio.forms.definition;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.portfolio.forms.definition.FormDefinitionEntity.Status;

interface FormDefinitionRepository extends JpaRepository<FormDefinitionEntity, Long> {

	Optional<FormDefinitionEntity> findByFormKeyAndVersion(String formKey, int version);

	Optional<FormDefinitionEntity> findFirstByFormKeyAndStatusOrderByVersionDesc(String formKey, Status status);

	@Query("select max(d.version) from FormDefinitionEntity d where d.formKey = :formKey")
	Optional<Integer> findMaxVersion(String formKey);

	/** Version metadata without the definition CLOB. */
	@Query("""
			select new com.portfolio.forms.definition.VersionInfo(
			    d.formKey, d.version, d.title, d.status, d.createdAt, d.updatedAt, d.publishedAt)
			from FormDefinitionEntity d
			where (:formKey is null or d.formKey = :formKey)
			order by d.formKey, d.version desc""")
	List<VersionInfo> findVersionInfo(String formKey);
}
