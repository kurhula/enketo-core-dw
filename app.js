/**
 * This file is just meant to facilitate enketo-core development as a standalone library.
 *
 * When using enketo-core as a library inside your app, it is recommended to just **ignore** this file.
 * Place a replacement for this controller elsewhere in your app.
 */

define('jquery', [], function() {
    return jQuery;
});

//Hack to not include generated bootstrap files but use the one included by datawinners htmls
define('bootstrap', [], function() {
    return jQuery;
});

function getFormData(data) {
    var formData = new FormData();
    formData.append("form_data", data);
    formData.append("form_code", questionnaire_code);
    return addAttachmentData(formData);
}

function addAttachmentData(formData) {
    var retainFiles = [];
    var mediaInputs = $('form.or input[type="file"]');
    if (!mediaInputs)
        return formData;

    mediaInputs.each(function () {
        var file = this.files[0];
        //Take the latest selected file for upload
        if (file) {
            formData.append(file.name, file);
        }
        if (submissionUpdateUrl) {
            var fileNotChangedDuringEdit = $(this).attr('data-loaded-file-name');
            if (fileNotChangedDuringEdit) {
                retainFiles.push(fileNotChangedDuringEdit);
            }
        }
    });
    if (retainFiles.length > 0)
        formData.append("retain_files", retainFiles);

    return formData;
}

function saveXformSubmission(callback) {
    form.validate();
    if (form.isValid()){
        DW.loading();
        var dataXml = form.getDataStr();
        var saveURL = submissionUpdateUrl || submissionCreateUrl;

        var success = function (data, status) {
            DW.trackEvent('advanced-qns-submission', 'advanced-qns-submission-success');
            if(typeof(callback) == "function")
                callback();
            else
                window.location.reload();
        };

        var error = function(){
            DW.trackEvent('advanced-qns-submission', 'advanced-qns-submission-failure');
        };
        var formData = getFormData(dataXml);
        $.ajax({
            url: saveURL,
            type: "POST",
            data: formData,
            processData: false,
            contentType: false,
            success: success,
            error: error
        });
    }
}

requirejs( [ 'require-config' ], function( rc ) {
    requirejs( [ 'jquery', 'enketo-js/support', 'enketo-js/Form', 'file-manager', 'papaparse' ],
        function( $, support, Form, fileManager, Papa ) {
            var loadErrors, form, formStr, modelStr, externalData, csvContent, $modelXml;
            // if querystring touch=true is added, override detected touchscreen presence
            if ( getURLParameter( 'touch' ) === 'true' ) {
                support.touch = true;
                $( 'html' ).addClass( 'touch' );
            }

            $( '.guidance' ).remove();
            var $data;
            data = xform_xml.replace( /jr\:template=/gi, 'template=' );
            $data = $( $.parseXML( data ) );
            $($data.find( 'form:eq(0)' )[0]).find("#form-title").remove();

            formStr = ( new XMLSerializer() ).serializeToString( $data.find( 'form:eq(0)' )[ 0 ] );
            modelStr = ( new XMLSerializer() ).serializeToString( $data.find( 'model:eq(0)' )[ 0 ] );
            externalData = [];

            $( '#validate-form' ).before( formStr );
            
            $modelXml = $($.parseXML( modelStr ));
            $modelXml.find('model > instance[src]').each(function (index, instance) { 
                var $instance = $(instance).attr('id');
                externalData.push( { id: $instance } ); 
            });
            
            $.get( externalItemsetUrl, function( data ) {
              csvContent = data;
              externalData = externalData.map(function (instance) {
                    return {
                        id: instance.id,
                        xmlStr: csvToXml(csvContent, instance)
                    };
                });

            $("form").trigger("initializePostFormLoadAction");
            initializeForm();
            $("form").trigger("postFormLoadAction");
        

        //validate handler for validate button
        $( '#validate-form' ).on( 'click', function() {
            saveXformSubmission();
                console.log( 'media files:', fileManager.getCurrentFiles() );
        });
        });

        // csv to xml
        function csvToXml( csv, instance ) {
            var xmlStr,
                result = Papa.parse( csv ),
                rows = result.data,
                headers = rows.shift();

            if ( result.errors.length ) {    throw result.errors[ 0 ];}
                // trim the headers
                headers = headers.map( function( header ) {
                return header.trim();
            } );

            // check if headers are valid XML node names
            headers.every( _throwInvalidXmlNodeName );

            // create an XML string
            xmlStr = '<root>' +
                rows.map( function( row ) {
                   if (row[0] == instance.id) {
                    return '<item>' + row.map( function( value, index ) {
                       if (value != "" && index != 0) {
                        return '<{n}>{v}</{n}>'.replace( /{n}/g, headers[ index ] ).replace( /{v}/g, value.trim() );
                       }
                    } ).join( '' ) + '</item>';
                   }
                } ).join( '' ) +
                '</root>';

            return xmlStr;
        }

        function _throwInvalidXmlNodeName( name ) {
            // Note: this is more restrictive than XML spec.
            // We cannot accept namespaces prefixes because there is no way of knowing the namespace uri in CSV.
            if ( /^(?!xml)[A-Za-z._][A-Za-z0-9._]*$/.test( name ) ) {
                return true;
            } else {
                throw new Error( 'CSV column heading "' + name + '" cannot be turned into a valid XML element' );
            }
        }

        // initialize the form
        function initializeForm() {
            form = new Form( 'form.or:eq(0)', {
                    modelStr: modelStr,
                    external: externalData,
                    instanceStr: dataStrToEdit
            } );
            // for debugging
            window.form = form;
            //initialize form and check for load errors
            loadErrors = form.init();
            if ( loadErrors.length > 0 ) {
                alert( 'loadErrors: ' + loadErrors.join( ', ' ) );
            }

        }

            // get query string parameter
            function getURLParameter( name ) {
                return decodeURI(
                    ( new RegExp( name + '=' + '(.+?)(&|$)' ).exec( location.search ) || [ null, null ] )[ 1 ]
                );
            }
        } );
} );
